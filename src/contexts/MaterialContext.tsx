import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Material, MaterialSettings, MaterialType } from "@/types/material";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Coaching Material Inventory — Material Types (Settings master data) and
 * the Material catalog itself are bounded, admin-managed lists (same
 * "preload up to a few hundred, cache in state" pattern as
 * BatchContext/AcademicContext), so they live here. Stock movements,
 * distributions, dashboard stats, and reports are transactional/historical
 * data that can grow without bound — those are fetched on demand, paginated,
 * directly from the relevant page/tab component instead (same split
 * AdmissionResult/ChanceResults already established in this app).
 *
 * Material Types are kept in this context rather than AcademicContext to
 * avoid growing that already-large shared context for a module-specific
 * concern — every other page that reads AcademicContext is unaffected.
 */
function withId<T extends { _id: string }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

interface Ctx {
  materials: Material[];
  materialTypes: MaterialType[];
  activeMaterialTypes: MaterialType[];
  materialSettings: MaterialSettings;
  loading: boolean;

  addMaterial: (data: Omit<Material, "id" | "currentStock" | "status"> & { status?: Material["status"] }) => Promise<Material>;
  updateMaterial: (id: string, data: Partial<Material>) => Promise<Material>;
  setMaterialStatus: (id: string, status: Material["status"]) => Promise<Material>;
  addStock: (materialId: string, quantity: number, reason?: string) => Promise<Material>;
  adjustStock: (materialId: string, quantity: number, reason: string, note?: string) => Promise<Material>;

  addMaterialType: (data: Omit<MaterialType, "id">) => Promise<MaterialType>;
  updateMaterialType: (id: string, data: Partial<MaterialType>) => Promise<MaterialType>;
  deleteMaterialType: (id: string) => Promise<void>;

  updateMaterialSettings: (patch: Partial<MaterialSettings>) => Promise<void>;

  getMaterial: (id: string) => Material | undefined;
  refreshMaterials: () => Promise<void>;
  refreshMaterialTypes: () => Promise<void>;
}

const MaterialContext = createContext<Ctx | null>(null);

const LIST_LIMIT = "?limit=300";
const DEFAULT_SETTINGS: MaterialSettings = { duplicateDistributionRule: "warn", defaultMinimumStock: 0 };

export function MaterialProvider({ children }: { children: React.ReactNode }) {
  const { initializing, user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [materialSettings, setMaterialSettings] = useState<MaterialSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshMaterials = useCallback(async () => {
    const docs = await api.get<{ _id: string }[]>(`/materials${LIST_LIMIT}`);
    setMaterials(docs.map(withId) as Material[]);
  }, []);

  const refreshMaterialTypes = useCallback(async () => {
    const docs = await api.get<{ _id: string }[]>(`/material-types${LIST_LIMIT}`);
    setMaterialTypes(docs.map(withId) as MaterialType[]);
  }, []);

  const refreshMaterialSettings = useCallback(async () => {
    const settings = await api.get<MaterialSettings>("/settings/material");
    setMaterialSettings(settings);
  }, []);

  useEffect(() => {
    if (initializing) return;
    if (!user) { setLoading(false); return; }
    Promise.all([refreshMaterials(), refreshMaterialTypes(), refreshMaterialSettings()])
      .catch(() => { /* offline */ })
      .finally(() => setLoading(false));
  }, [initializing, user, refreshMaterials, refreshMaterialTypes, refreshMaterialSettings]);

  const addMaterial = useCallback(async (data: Omit<Material, "id" | "currentStock" | "status"> & { status?: Material["status"] }): Promise<Material> => {
    const created = withId(await api.post<{ _id: string }>("/materials", data)) as Material;
    setMaterials((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateMaterial = useCallback(async (id: string, data: Partial<Material>): Promise<Material> => {
    const updated = withId(await api.patch<{ _id: string }>(`/materials/${id}`, data)) as Material;
    setMaterials((prev) => prev.map((m) => (m.id === id ? updated : m)));
    return updated;
  }, []);

  const setMaterialStatus = useCallback(async (id: string, status: Material["status"]): Promise<Material> => {
    const updated = withId(await api.patch<{ _id: string }>(`/materials/${id}/status`, { status })) as Material;
    setMaterials((prev) => prev.map((m) => (m.id === id ? updated : m)));
    return updated;
  }, []);

  const addStock = useCallback(async (materialId: string, quantity: number, reason?: string): Promise<Material> => {
    const updated = withId(await api.post<{ _id: string }>(`/materials/${materialId}/stock/add`, { quantity, reason })) as Material;
    setMaterials((prev) => prev.map((m) => (m.id === materialId ? updated : m)));
    return updated;
  }, []);

  const adjustStock = useCallback(async (materialId: string, quantity: number, reason: string, note?: string): Promise<Material> => {
    const updated = withId(await api.post<{ _id: string }>(`/materials/${materialId}/stock/adjust`, { quantity, reason, note })) as Material;
    setMaterials((prev) => prev.map((m) => (m.id === materialId ? updated : m)));
    return updated;
  }, []);

  const addMaterialType = useCallback(async (data: Omit<MaterialType, "id">): Promise<MaterialType> => {
    const created = withId(await api.post<{ _id: string }>("/material-types", data)) as MaterialType;
    setMaterialTypes((prev) => [...prev, created]);
    return created;
  }, []);

  const updateMaterialType = useCallback(async (id: string, data: Partial<MaterialType>): Promise<MaterialType> => {
    const updated = withId(await api.patch<{ _id: string }>(`/material-types/${id}`, data)) as MaterialType;
    setMaterialTypes((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const deleteMaterialType = useCallback(async (id: string) => {
    await api.del(`/material-types/${id}`);
    setMaterialTypes((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateMaterialSettingsFn = useCallback(async (patch: Partial<MaterialSettings>) => {
    const updated = await api.patch<MaterialSettings>("/settings/material", patch);
    setMaterialSettings(updated);
  }, []);

  const getMaterial = useCallback((id: string) => materials.find((m) => m.id === id), [materials]);

  const activeMaterialTypes = useMemo(() => materialTypes.filter((t) => t.status !== "নিষ্ক্রিয়"), [materialTypes]);

  const value = useMemo<Ctx>(
    () => ({
      materials, materialTypes, activeMaterialTypes, materialSettings, loading,
      addMaterial, updateMaterial, setMaterialStatus, addStock, adjustStock,
      addMaterialType, updateMaterialType, deleteMaterialType,
      updateMaterialSettings: updateMaterialSettingsFn,
      getMaterial, refreshMaterials, refreshMaterialTypes,
    }),
    [materials, materialTypes, activeMaterialTypes, materialSettings, loading,
      addMaterial, updateMaterial, setMaterialStatus, addStock, adjustStock,
      addMaterialType, updateMaterialType, deleteMaterialType,
      updateMaterialSettingsFn, getMaterial, refreshMaterials, refreshMaterialTypes],
  );

  return <MaterialContext.Provider value={value}>{children}</MaterialContext.Provider>;
}

export function useMaterials() {
  const ctx = useContext(MaterialContext);
  if (!ctx) throw new Error("useMaterials must be within MaterialProvider");
  return ctx;
}
