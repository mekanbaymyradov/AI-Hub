import { describe, expect, it } from "vitest";
import { normalizeMath } from "./normalize-math";

describe("normalizeMath", () => {
  it("turns \\( \\) into inline math", () => {
    expect(normalizeMath("so \\(a^2 + b^2\\) holds")).toBe("so $a^2 + b^2$ holds");
  });

  it("trims spaces inside \\( \\), which $ math doesn't allow", () => {
    expect(normalizeMath("\\( x + 1 \\)")).toBe("$x + 1$");
  });

  it("turns \\[ \\] into display math", () => {
    expect(normalizeMath("\\[\n\\frac{1}{2}\n\\]")).toBe("$$\n\\frac{1}{2}\n$$");
  });

  it("keeps $ math that follows Pandoc's rule", () => {
    const text = "$x$, $5$ and $E = mc^2$";
    expect(normalizeMath(text)).toBe(text);
  });

  it("escapes prices", () => {
    expect(normalizeMath("costs $5 and $10.")).toBe("costs \\$5 and \\$10.");
  });

  it("keeps a $ the model already escaped", () => {
    expect(normalizeMath("only \\$7")).toBe("only \\$7");
  });

  // Shows as text while it streams, and as math once the closing $$ arrives.
  it("escapes a $$ block that hasn't closed yet", () => {
    expect(normalizeMath("$$\n\\int")).toBe("\\$\\$\n\\int");
  });

  it("leaves code alone", () => {
    const text = "`\\(x\\)` and\n```\nprice = \"$5\"  # \\[y\\]\n```";
    expect(normalizeMath(text)).toBe(text);
  });
});
