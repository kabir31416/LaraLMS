import { Schema, model, Document } from "mongoose";

export interface AccountSettingsDoc extends Document {
  incomeCategories: string[];
  expenseCategories: string[];
}

const accountSettingsSchema = new Schema<AccountSettingsDoc>({
  incomeCategories: { type: [String], default: ["ভর্তি ফি", "কোর্স ফি", "বই বিক্রি", "পরীক্ষা ফি", "অন্যান্য"] },
  expenseCategories: { type: [String], default: ["শিক্ষক বেতন", "ভাড়া", "বিদ্যুৎ", "স্টাফ", "মার্কেটিং", "অন্যান্য"] },
});

export const AccountSettings = model<AccountSettingsDoc>("AccountSettings", accountSettingsSchema);
