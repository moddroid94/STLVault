import type { ModelGroup, STLModel } from "../types.ts";

export type VisibleModelGroup = ModelGroup & { models: STLModel[] };

/**
 * A folder or search match decides whether a group is visible. Once visible,
 * the group is treated as one unit and always contains every available part.
 */
export const buildVisibleGroups = (
  groups: ModelGroup[],
  matchingScopedModels: STLModel[],
  allModels: STLModel[],
  includeEmpty = false,
): VisibleModelGroup[] => {
  const matchingIds = new Set(matchingScopedModels.map((model) => model.id));
  const modelsById = new Map(allModels.map((model) => [model.id, model]));

  return groups
    .filter(
      (group) =>
        group.modelIds.some((id) => matchingIds.has(id)) ||
        (includeEmpty && group.modelIds.length === 0),
    )
    .map((group) => ({
      ...group,
      models: group.modelIds
        .map((id) => modelsById.get(id))
        .filter((model): model is STLModel => Boolean(model)),
    }))
    .filter((group) => includeEmpty || group.models.length > 0);
};
