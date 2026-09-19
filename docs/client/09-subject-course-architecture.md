# Document 09 — Subject/Course Architecture (Global Subjects Refactor)

This document explains the `Course → CourseSubject → Subject → Lecture` relationship introduced to eliminate Subject duplication, why it's shaped this way, and how to run the one-time data migration.

## 9.1 The problem this solves

Before this refactor, a `Subject` document belonged to exactly one `Course` (`subject.courseId`). A Subject like "বাংলা" that was genuinely needed in three different Courses had to be created three separate times — three different Subject documents, all named "বাংলা", with no relationship to each other. This made:

- Reporting and search inconsistent (which "বাংলা" is this?).
- Subject management tedious (editing "বাংলা" meant editing it N times).
- The data model lie about reality: বাংলা is one subject taught in different courses, not three unrelated subjects that happen to share a name.

## 9.2 The new relationship

```
Course
  ↓
CourseSubject   (the assignment: "this Course teaches this Subject, in this order")
  ↓
Subject         (global — created once, referenced by any number of Courses)
  ↓
Lecture         (belongs to the CourseSubject, never to the Subject directly)
```

**Why Subjects are global.** A Subject (`backend/src/modules/subjects/subject.model.ts`) now has no `courseId` at all — just `name`, an optional `code`, `status`, and `displayOrder`. It's a pure catalog entry, created once from Settings → Subjects, and reused everywhere.

**How Courses assign Subjects.** `CourseSubject` (`backend/src/modules/courseSubjects/`) is the join: `{ courseId, subjectId, order, status }`, with a unique compound index on `(courseId, subjectId)` — the same Subject can be assigned to unlimited Courses, but never assigned twice to the same Course. This is managed from Course Management's "সাবজেক্ট যোগ করুন" (Add Subject) picker, which only ever lists *existing* global Subjects — it never opens a form to create a new one.

**Why Lectures are course-specific.** `Lecture.courseSubjectId` (not `subjectId`) is the actual foreign key. This is the detail that makes the whole design work: if "বাংলা" is assigned to both BSc Nursing and Diploma Nursing, those are two *different* CourseSubject rows, so BSc Nursing's বাংলা Lectures and Diploma Nursing's বাংলা Lectures are two independent lists that never mix, even though both ultimately point at the same global Subject.

## 9.3 Where a "course-subject id" vs. a "subject id" is used

Two different IDs matter here, and the codebase is deliberate about which one is used where:

- **`subjectId`** (global) — used for anything that only cares about *which subject*, regardless of course: the Settings → Subjects catalog, Material's optional subject tag, and result/marksheet display (a result's guardian SMS, the public marksheet, Result Management's subject filter — all denormalize/read the global Subject name, since a Subject's identity doesn't depend on which Course it's taught under).
- **`courseSubjectId`** — used for anything that needs to resolve *which Lectures*: Lecture's own foreign key, and the exam/result-entry creation flow (`POST /exams`, `/exams/save-result`, `/exams/submit-result`), because that's the only ID that unambiguously identifies "this Lecture, in this Course, under this Subject."

`OfflineExam` (an offline result-entry session) stores **both**: `courseSubjectId` (the canonical link, validated against the Batch's own Course at creation time) and a denormalized `subjectId` (copied from the CourseSubject at write time). This is why the SMS template, the public marksheet aggregation, and Result Management's read views needed **no changes** — they already read `exam.subjectId` and that field still means exactly what it always meant.

## 9.4 API surface

```
GET/POST/PATCH/DELETE /subjects                      Global Subject catalog
GET                    /course-subjects               Every CourseSubject, across every Course (one query — avoids N+1)
GET/POST               /courses/:courseId/subjects    A Course's own Subject list / assign an existing Subject
PATCH/DELETE           /courses/:courseId/subjects/:courseSubjectId   Reorder, (de)activate, or remove an assignment
GET/POST/PATCH/DELETE  /lectures?courseSubjectId=...  Lectures, filtered by CourseSubject
```

Assigning an already-assigned Subject to a Course returns a clean `409` with a Bengali message (never a raw MongoDB duplicate-key error) — the frontend also pre-filters the picker to only show unassigned Subjects, so this should only ever surface from a genuine race (two admins assigning the same Subject at once).

## 9.5 Delete safety

- **Deleting a global Subject** is refused (409) if it's still assigned to any Course (`CourseSubject.exists({ subjectId })`). Unassign it from every Course first.
- **Removing a CourseSubject** (unassigning a Subject from one Course) is refused (409) if Lectures still exist under it — remove/reassign those first. It never touches the global Subject or any other Course's assignment of the same Subject.
- **Deleting a Course** is refused if it still has any CourseSubject assigned to it (same as before, just checking the new relationship).

## 9.6 Running the migration

Existing data predates this refactor: Subjects still have `courseId`, and Lectures/Exams still reference the old per-course Subject IDs directly. `backend/src/scripts/migrate-global-subjects.ts` converts this safely:

```
cd backend
npm run migrate:global-subjects              # dry run — reports what it WOULD do, writes nothing
npm run migrate:global-subjects -- --apply   # actually applies it
```

What it does, in order:

1. Groups existing Subject documents by exact, trimmed name (never fuzzy/case-insensitive — a wrong automatic merge is worse than leaving two similar names for a human to check).
2. Picks one canonical Subject per name (the oldest), and creates a `CourseSubject` row for every Course that used to have its own copy of that Subject.
3. Repoints every Lecture from its old `subjectId` to the correct new `courseSubjectId`.
4. Repoints every `OfflineExam.subjectId` to the canonical Subject and sets its new `courseSubjectId`.
5. Repoints the optional `Material.subjectId` reference the same way.
6. Removes `courseId` from the surviving canonical Subjects, and deletes the now-redundant duplicate Subject documents — only after every reference to them has been repointed.

It's safe to re-run: once every Subject name is unique (after a successful `--apply`), a second run finds nothing left to do. The dry run also prints any near-duplicate names (e.g. differing only by case) it deliberately did *not* merge, so they can be reviewed and merged by hand if appropriate.

**Back up the database before running `--apply` on production data.** This is a one-time, mostly-additive migration (it only deletes Subject documents that were genuine duplicates of a name that now has a canonical survivor), but it does modify Lecture/OfflineExam/Material documents in place.
