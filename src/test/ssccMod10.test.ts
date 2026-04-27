import { describe, it, expect } from "vitest";
import { generateSSCC, calculateSSCCCheckDigit } from "@/hooks/useHandlingUnits";

describe("SSCC GS1 Mod10", () => {
  it("generateSSCC returns 18-digit numeric string", () => {
    const sscc = generateSSCC();
    expect(sscc).toMatch(/^\d{18}$/);
    expect(sscc.length).toBe(18);
  });

  it("calculateSSCCCheckDigit('35901234000000001') === '8'", () => {
    // sum = 3*3+5*1+9*3+0*1+1*3+2*1+3*3+4*1+0*3+0*1+0*3+0*1+0*3+0*1+0*3+0*1+1*3
    //     = 9+5+27+0+3+2+9+4+0+0+0+0+0+0+0+0+3 = 62; (10 - 62%10)%10 = 8
    expect(calculateSSCCCheckDigit("35901234000000001")).toBe("8");
  });

  it("calculateSSCCCheckDigit('00000000000000000') === '0'", () => {
    expect(calculateSSCCCheckDigit("00000000000000000")).toBe("0");
  });

  it("calculateSSCCCheckDigit known vector '12345678901234567'", () => {
    // sum = 1*3+2+3*3+4+5*3+6+7*3+8+9*3+0+1*3+2+3*3+4+5*3+6+7*3
    //     = 3+2+9+4+15+6+21+8+27+0+3+2+9+4+15+6+21 = 155; (10-5)%10 = 5
    expect(calculateSSCCCheckDigit("12345678901234567")).toBe("5");
  });

  it("throws on input shorter than 17 digits", () => {
    expect(() => calculateSSCCCheckDigit("12345")).toThrow(/17 digits/);
  });

  it("throws on non-digit input", () => {
    expect(() => calculateSSCCCheckDigit("3590123400000000X")).toThrow();
  });

  it("100 generated SSCC are all unique", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateSSCC());
    expect(set.size).toBe(100);
  });

  it("every generated SSCC self-validates against mod10", () => {
    for (let i = 0; i < 50; i++) {
      const sscc = generateSSCC();
      const base17 = sscc.slice(0, 17);
      const check = sscc.slice(17);
      expect(calculateSSCCCheckDigit(base17)).toBe(check);
    }
  });

  it("generated SSCC starts with extension '3' + company prefix '5901234'", () => {
    const sscc = generateSSCC();
    expect(sscc.slice(0, 8)).toBe("35901234");
  });
});
