import { Schema, model, Document } from "mongoose";

export interface BookDoc extends Document {
  bookCode: string; // immutable, atomically generated — see idGenerators.ts
  name: string;
  subject: string;
  class: string;
  author?: string;
  price: number;
  totalStock: number; // central/main stock
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<BookDoc>(
  {
    bookCode: { type: String, required: true, unique: true, immutable: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    class: { type: String, required: true, trim: true },
    author: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    totalStock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

bookSchema.index({ name: "text" });

export const Book = model<BookDoc>("Book", bookSchema);
