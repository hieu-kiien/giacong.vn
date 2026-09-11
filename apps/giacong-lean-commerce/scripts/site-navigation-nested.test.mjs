import assert from "node:assert/strict";
import test from "node:test";

import { applyNavigationToMarkup, validateNavigationTree } from "../src/lib/site-navigation.ts";

const item = (id, parentId = null, sortOrder = 10) => ({ id, parentId, menuKey: "primary", label: id, href: `/${id}`, isActive: true, sortOrder });

test("nested navigation keeps parent/child order deterministic", () => {
  const result = validateNavigationTree([item("child", "parent", 20), item("parent", null, 10), item("sibling", null, 30)]);
  assert.deepEqual(result.map((entry) => entry.id), ["parent", "child", "sibling"]);
});

test("nested navigation rejects missing parents, cross-menu parents and cycles", () => {
  assert.throws(() => validateNavigationTree([item("child", "missing")]), /cha|parent/i);
  assert.throws(() => validateNavigationTree([{ ...item("parent"), menuKey: "footer" }, item("child", "parent")]), /menu/i);
  assert.throws(() => validateNavigationTree([item("a", "b"), item("b", "a")]), /cycle/i);
});

test("nested navigation rejects invalid ids and links before persistence", () => {
  assert.throws(() => validateNavigationTree([{ ...item("bad"), id: "bad.id" }]), /id/i);
  assert.throws(() => validateNavigationTree([{ ...item("bad"), href: "javascript:alert(1)" }]), /href/i);
});

test("nested custom child is rendered below its published parent without changing legacy markup", () => {
  const markup = '<ul class="header-nav-main"><li id="menu-item-parent"><a href="/parent">Parent</a></li><li id="menu-item-sibling"><a href="/sibling">Sibling</a></li></ul>';
  const result = applyNavigationToMarkup(markup, [
    { id: "parent", capturedMenuId: "menu-item-parent", parentId: null, href: "/parent", isActive: true, label: "Parent", menuKey: "primary", sortOrder: 10 },
    { id: "child", capturedMenuId: null, parentId: "parent", href: "/child", isActive: true, label: "Child", menuKey: "primary", sortOrder: 20 },
    { id: "sibling", capturedMenuId: "menu-item-sibling", parentId: null, href: "/sibling", isActive: true, label: "Sibling", menuKey: "primary", sortOrder: 30 },
  ]);
  assert.match(result, /menu-item-parent[\s\S]*nested-navigation-child[\s\S]*Child/);
  assert.match(result, /menu-item-sibling/);
});

test("custom parent and child render as one ordered tree", () => {
  const markup = '<ul class="header-nav-main"></ul>';
  const result = applyNavigationToMarkup(markup, [
    { id: "child", capturedMenuId: null, parentId: "parent", href: "/child", isActive: true, label: "Child", menuKey: "primary", sortOrder: 20 },
    { id: "parent", capturedMenuId: null, parentId: null, href: "/parent", isActive: true, label: "Parent", menuKey: "primary", sortOrder: 10 },
  ]);
  assert.match(result, /Parent[\s\S]*nested-navigation-children[\s\S]*Child/);
});

test("an inactive parent does not expose an active child", () => {
  const markup = '<ul class="header-nav-main"><li id="menu-item-parent"><a href="/parent">Parent</a></li></ul>';
  const result = applyNavigationToMarkup(markup, [
    { id: "parent", capturedMenuId: "menu-item-parent", parentId: null, href: "/parent", isActive: false, label: "Parent", menuKey: "primary", sortOrder: 10 },
    { id: "child", capturedMenuId: null, parentId: "parent", href: "/child", isActive: true, label: "Child", menuKey: "primary", sortOrder: 20 },
  ]);
  assert.match(result, /menu-item-parent[^>]*hidden/);
  assert.match(result, /nested-navigation-child/);
});

test("navigation rendering stays bounded when a corrupted custom tree is too deep", () => {
  const items = Array.from({ length: 12000 }, (_, index) => ({
    id: `deep-${index}`,
    parentId: index === 0 ? null : `deep-${index - 1}`,
    menuKey: "primary",
    label: `Deep ${index}`,
    href: `/deep-${index}`,
    isActive: true,
    sortOrder: index,
  }));
  assert.doesNotThrow(() => applyNavigationToMarkup('<ul class="header-nav-main"></ul>', items));
});
