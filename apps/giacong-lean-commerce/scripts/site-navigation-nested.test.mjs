import assert from "node:assert/strict";
import test from "node:test";

import { legacyMegaMenuItems } from "../src/data/legacy-mega-menu.ts";
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

test("published legacy mega-menu child overrides its captured label and destination", () => {
  const sourceItem = legacyMegaMenuItems.find((item) => item.owner === "products" && item.href === "/gia-cong-sua-bot/");
  assert.ok(sourceItem);
  const markup = `<div class="sub-menu nav-dropdown"><div class="ux-menu-link flex menu-item" data-navigation-id="${sourceItem.id}"><a class="ux-menu-link__link flex" href="${sourceItem.href}"><span class="ux-menu-link__text">${sourceItem.label}</span></a></div></div>`;
  const result = applyNavigationToMarkup(markup, [{
    id: "managed-child",
    capturedMenuId: sourceItem.id,
    parentId: "products",
    href: "/demo-sua-bot/",
    isActive: true,
    label: "Sữa bột demo",
    menuKey: "primary",
    sortOrder: 10,
  }]);
  assert.match(result, /data-navigation-id="products-gia-cong-sua-bot"/);
  assert.match(result, /href="\/demo-sua-bot\/"/);
  assert.match(result, />Sữa bột demo<\/span>/);
});

test("managed service mega-menu children are also exposed in the mobile service menu", () => {
  const sourceItem = legacyMegaMenuItems.find((item) => item.owner === "services" && item.href === "/say-thang-hoa/");
  assert.ok(sourceItem);
  const markup = [
    '<ul class="header-nav-main"><li id="menu-item-5166"><a href="/thue-gia-cong/">Thuê gia công</a><div class="nav-dropdown"><div class="ux-menu-link flex menu-item" data-navigation-id="',
    sourceItem.id,
    '"><a class="ux-menu-link__link flex" href="',
    sourceItem.href,
    '"><span class="ux-menu-link__text">',
    sourceItem.label,
    '</span></a></div></div></li></ul>',
    '<ul class="nav-sidebar"><li id="menu-item-5466"><a href="/thue-gia-cong/">Thuê gia công</a><ul class="sub-menu nav-sidebar-ul children"><li><a href="/dich-vu-say/">Dịch Vụ Sấy</a></li></ul></li></ul>',
  ].join("");
  const result = applyNavigationToMarkup(markup, [{
    id: "managed-service-child",
    capturedMenuId: sourceItem.id,
    parentId: "services",
    href: "/demo-say-thang-hoa/",
    isActive: true,
    label: "Sấy thăng hoa demo",
    menuKey: "primary",
    sortOrder: 10,
  }]);

  assert.match(result, /id="menu-item-5466"[\s\S]*managed-legacy-navigation-child[\s\S]*href="\/demo-say-thang-hoa\/"[\s\S]*Sấy thăng hoa demo/);
});

test("inactive legacy mega-menu child is hidden without leaking a dead link", () => {
  const sourceItem = legacyMegaMenuItems.find((item) => item.owner === "services" && item.isPlaceholder);
  assert.ok(sourceItem);
  const markup = `<div class="ux-menu-link flex menu-item" data-navigation-id="${sourceItem.id}"><span class="ux-menu-link__link flex"><span class="ux-menu-link__text">${sourceItem.label}</span></span></div>`;
  const result = applyNavigationToMarkup(markup, [{
    id: "managed-placeholder",
    capturedMenuId: sourceItem.id,
    parentId: "services",
    href: sourceItem.href,
    isActive: false,
    label: sourceItem.label,
    menuKey: "primary",
    sortOrder: 10,
  }]);
  assert.match(result, /class="[^"]*hidden[^"]*"[^>]*data-navigation-id="services-[^"]+"/);
  assert.doesNotMatch(result, /<a\b/);
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
