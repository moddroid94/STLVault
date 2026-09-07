import assert from "node:assert/strict";
import test from "node:test";

import { buildVisibleGroups } from "./modelGroupView.ts";
import type { ModelGroup, STLModel } from "../types.ts";

const model = (
  id: string,
  folderId: string,
  groupId: string | null,
): STLModel => ({
  id,
  folderId,
  groupId,
  groupName: groupId ? "Desk organizer" : null,
  name: `${id}.stl`,
  url: `/api/models/${id}/download`,
  size: 1,
  dateAdded: 1,
  tags: [],
  description: "",
});

const group: ModelGroup = {
  id: "desk",
  name: "Desk organizer",
  dateAdded: 1,
  modelIds: ["body", "lid", "handle"],
};

const allModels = [
  model("body", "folder-a", "desk"),
  model("lid", "folder-b", "desk"),
  model("handle", "folder-b", "desk"),
  model("loose", "folder-a", null),
];

test("a group shown from one folder includes every part", () => {
  const groups = buildVisibleGroups([group], [allModels[0]], allModels);

  assert.deepEqual(
    groups[0].models.map((item) => item.id),
    ["body", "lid", "handle"],
  );
});

test("a search match on one member includes every part", () => {
  const groups = buildVisibleGroups([group], [allModels[1]], allModels);

  assert.deepEqual(
    groups[0].models.map((item) => item.id),
    ["body", "lid", "handle"],
  );
});

test("groups without a matching scoped member stay hidden", () => {
  const groups = buildVisibleGroups([group], [allModels[3]], allModels);

  assert.deepEqual(groups, []);
});

test("the groups management view keeps legacy empty groups manageable", () => {
  const emptyGroup: ModelGroup = {
    id: "empty",
    name: "Empty group",
    dateAdded: 1,
    modelIds: [],
  };

  const groups = buildVisibleGroups([emptyGroup], [], allModels, true);

  assert.equal(groups[0].name, "Empty group");
  assert.deepEqual(groups[0].models, []);
});
