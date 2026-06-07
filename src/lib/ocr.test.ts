import { describe, it, expect } from "vitest"
import { isMineruAvailable, mineruExtractText } from "./ocr"

describe("isMineruAvailable", () => {
  it("returns false when MINERU_API_URL is not set", () => {
    // In test env, MINERU_API_URL is not set
    expect(isMineruAvailable()).toBe(false)
  })
})

describe("mineruExtractText", () => {
  it("throws when MinerU is not configured", async () => {
    const buffer = new ArrayBuffer(10)
    await expect(mineruExtractText(buffer, "test.pdf")).rejects.toThrow("MinerU 未配置")
  })
})
