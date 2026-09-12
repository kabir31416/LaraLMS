import { Model, HydratedDocument } from "mongoose";

/** Fetches the one document a singleton collection (Settings, PublicInfoSettings) should ever have, creating it with defaults on first use. */
export async function getOrCreateSingleton<T>(model: Model<T>, defaults: T): Promise<HydratedDocument<T>> {
  let doc = await model.findOne();
  if (!doc) doc = await model.create(defaults);
  return doc as HydratedDocument<T>;
}
