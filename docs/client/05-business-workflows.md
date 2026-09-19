# Document 05 — Business Workflows

The same processes as Document 03, shown as flow diagrams for a quick, whole-picture read.

## 5.1 Admission Workflow

```mermaid
flowchart TD
    A[Admission form started] --> B[Student + guardian details entered]
    B --> C[Course selected]
    C --> D[Registration ID auto-generated]
    D --> E[Course Fee + Admission Fee snapshotted]
    E --> F{Discount entered?}
    F -->|Yes| G[Total due reduced]
    F -->|No| H[Total due = full fee]
    G --> I{Amount paid now?}
    H --> I
    I -->|Yes| J[Payment recorded + Receipt generated]
    I -->|No| K[Student created with full due]
    J --> L[Batch assignment]
    K --> L
```

## 5.2 Student Lifecycle

```mermaid
flowchart LR
    A[Admitted] --> B[Assigned to Batch]
    B --> C[Attendance + Results recorded each session]
    C --> D[Payments tracked over time]
    D --> E{Transfer batch?}
    E -->|Yes| B
    E -->|No| F[Continues in same batch]
    F --> G[Eventually: course completion / withdrawal]
```

## 5.3 Payment Workflow

```mermaid
flowchart TD
    A[Student selected in Fee Management] --> B[Fee type + method + amount entered]
    B --> C[Duplicate-click guard checks request]
    C --> D[Payment saved, unique Receipt Number generated]
    D --> E[Student's Total Paid / Due updated]
    D --> F[Printable Receipt available immediately]
```

## 5.4 Course → Batch → Student Workflow

```mermaid
flowchart LR
    S[Academic Session] --> C[Course incl. Fee]
    C --> Sub[Subjects]
    Sub --> L[Lectures]
    C --> B[Batch: time, days, room, Director]
    B --> St[Students assigned]
```

## 5.5 Academic Workflow

```mermaid
flowchart LR
    Session --> Course --> Subject --> Lecture --> Exam --> Result
```

## 5.6 Result & SMS Workflow

```mermaid
flowchart TD
    A[Batch Director opens Result Entry] --> B[Marks entered per student]
    B --> C{Save or Send?}
    C -->|Save Result| D[Marks + attendance stored, no SMS]
    C -->|Send Result| E[Marks + attendance stored]
    E --> F[Guardian SMS sent using template]
    F --> G{Delivery failed for some?}
    G -->|Yes| H[Failed students listed, retry available]
    G -->|No| I[Complete]
```

## 5.7 Material Distribution Workflow

```mermaid
flowchart LR
    A[Material added to stock] --> B[Distribution requested for a student]
    B --> C{Free or Paid?}
    C -->|Paid| D[Payment created automatically]
    C -->|Free| E[Distribution recorded, no payment]
    D --> F[Stock reduced, history logged]
    E --> F
```

## 5.8 Branch Ledger Workflow

```mermaid
flowchart LR
    A[Money/material sent to Branch] --> B[Logged as Expense]
    C[Money received back from Branch] --> D[Logged as Income]
    B --> E[Due = Expense minus Income]
    D --> E
```

## 5.9 Public Result Workflow

```mermaid
flowchart TD
    A[Admin enables Public Marksheet in Settings] --> B[Chooses individual / batch / both]
    B --> C[Chooses which fields are visible]
    C --> D[Visitor searches by Roll Number or Batch]
    D --> E{Result exists and matches rules? e.g. must be Published}
    E -->|Yes| F[Result shown with only the enabled fields]
    E -->|No| G[Clear not-found message, no data leak]
```

## 5.10 Password Change / Forced Reset Workflow (added v1.1)

```mermaid
flowchart TD
    A[User logs in] --> B{mustChangePassword flag set?}
    B -->|Yes| C[Full-screen forced Change Password prompt]
    C --> D[User sets new password]
    D --> E[Flag cleared, normal app access granted]
    B -->|No| E
    E --> F{User opens account menu later}
    F --> G[Voluntary Change Password from Topbar]
    G --> E
```
