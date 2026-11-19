import { describe, expect, it } from "vitest";
import i18n from "./index";
import { en } from "./en";
import { ru } from "./ru";
import { tk } from "./tk";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === "string" ? [[prefix + key, value]] : Object.entries(flatten(value, `${prefix}${key}.`))
    )
  );
}

// The {{variables}} and <b> tags a string must keep, whatever the language.
const markers = (text: string) => [...text.matchAll(/\{\{\w+\}\}|<\/?b>/g)].map((m) => m[0]).sort();

const english = flatten(en);

describe.each([
  ["ru", ru],
  ["tk", tk],
])("%s translation", (_, translation) => {
  const strings = flatten(translation);

  it("keeps every variable and highlight of the English text", () => {
    for (const [key, text] of Object.entries(strings)) {
      expect(markers(text), key).toEqual(markers(english[key]));
    }
  });

  it("has no empty strings", () => {
    for (const [key, text] of Object.entries(strings)) {
      expect(text.trim(), key).not.toBe("");
    }
  });
});

describe("Russian plurals", () => {
  const ruT = i18n.getFixedT("ru");

  it.each([
    [1, "Удалить 1 чат?"],
    [2, "Удалить 2 чата?"],
    [5, "Удалить 5 чатов?"],
    [11, "Удалить 11 чатов?"],
    [21, "Удалить 21 чат?"],
  ])("%i", (count, expected) => {
    expect(ruT("sidebar.deleteManyTitle", { count })).toBe(expected);
  });
});
