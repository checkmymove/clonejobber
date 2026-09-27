// Unit tests for shared request validators (scenarios 3,4,5,8,9,11 + edges).
// Run: npm run test:unit  (compiles lib/requests/*.ts to .testbuild first)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidEmail,
  isValidPhone,
  isValidUkPostcode,
  isValidTime,
  normalizePhone,
  sniffImageMime,
  validateContact,
  validateFileList,
  validateHours,
  validateInventory,
  validateLocation,
  validatePacking,
  validateServices,
} from "../.testbuild/validation.js";

const goodContact = {
  firstName: "Amelia",
  lastName: "Hart",
  companyName: "",
  email: "amelia@example.co.uk",
  phone: "+44 7700 900111",
  marketingEmail: false,
  marketingSms: false,
  leadSourceId: "ls-1",
  moveDate: "",
  moveTime: "09:30",
};

const goodLoc = {
  address: "12 Hackney Road",
  postcode: "E2 8DP",
  floor: "2nd Floor",
  hasLift: true,
  parking: "No restrictions",
  bedrooms: "2",
};

describe("contact", () => {
  it("accepts a valid contact with blank move date (scenario 3)", () => {
    assert.deepEqual(validateContact(goodContact), {});
  });
  it("rejects empty required fields (scenario 11)", () => {
    const e = validateContact({
      ...goodContact,
      firstName: "",
      email: "",
      phone: "",
      leadSourceId: "",
      moveTime: "",
    });
    for (const k of ["firstName", "email", "phone", "leadSourceId", "moveTime"]) {
      assert.ok(e[k], k);
    }
  });
  it("rejects bad email and phone", () => {
    const e = validateContact({ ...goodContact, email: "not-an-email", phone: "abc" });
    assert.ok(e.email && e.phone);
  });
  it("accepts international phones", () => {
    assert.ok(isValidPhone("+55 11 98765-4321"));
    assert.ok(isValidPhone("+44 7700 900111"));
    assert.ok(!isValidPhone("123"));
  });
  it("validates email shape", () => {
    assert.ok(isValidEmail("a.b@company.co.uk"));
    assert.ok(!isValidEmail("a@b"));
  });
});

describe("locations", () => {
  it("accepts a valid location", () => {
    assert.deepEqual(validateLocation(goodLoc), {});
  });
  it("rejects invalid UK postcode", () => {
    assert.ok(validateLocation({ ...goodLoc, postcode: "00000" }).postcode);
    assert.ok(isValidUkPostcode("SW11 3DG"));
  });
  it("requires lift answer and bedrooms", () => {
    const e = validateLocation({ ...goodLoc, hasLift: null, bedrooms: "" });
    assert.ok(e.hasLift && e.bedrooms);
  });
});

describe("packing/services/hours", () => {
  it("requires both packing answers", () => {
    assert.ok(validatePacking({ needsService: null, needsMaterials: null }).needsService);
    assert.deepEqual(
      validatePacking({ needsService: true, needsMaterials: false }),
      {},
    );
  });
  it("accepts multiple services from catalog (scenario 4)", () => {
    assert.deepEqual(validateServices(["s1", "s2"], ["s1", "s2", "s3"]), {});
  });
  it("rejects unknown service ids (scenario 13 logic)", () => {
    assert.ok(validateServices(["other-company-service"], ["s1"]).services);
  });
  it('accepts "I don\'t know" hours (scenario 5)', () => {
    assert.deepEqual(validateHours(["I don't know"]), {});
    assert.deepEqual(validateHours(["2", "3"]), {});
  });
  it("rejects invalid hours", () => {
    assert.ok(validateHours(["25"]).hours);
    assert.ok(validateHours([]).hours);
  });
});

describe("inventory + files", () => {
  it("requires a meaningful description", () => {
    assert.ok(validateInventory("sofa").inventory);
    assert.deepEqual(validateInventory("3 bedrooms, wardrobe, 40 boxes, sofa"), {});
  });
  const f = (n, size = 100, type = "image/jpeg") => ({ name: n, size, type });
  it("accepts up to 10 images (scenarios 6, 7)", () => {
    const files = Array.from({ length: 10 }, (_, i) => f(`img${i}.jpg`));
    assert.deepEqual(validateFileList(files, 10), {});
  });
  it("rejects the 11th image (scenario 8)", () => {
    const files = Array.from({ length: 11 }, (_, i) => f(`img${i}.jpg`));
    assert.ok(validateFileList(files, 10).images);
  });
  it("rejects duplicates, bad mime and oversize", () => {
    assert.ok(validateFileList([f("a.jpg"), f("a.jpg")], 10).images);
    assert.ok(validateFileList([f("a.pdf", 100, "application/pdf")], 10).images);
    assert.ok(validateFileList([f("a.jpg", 9 * 1024 * 1024)], 10).images);
  });
  it("sniffs magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    assert.equal(sniffImageMime(png), "image/png");
    assert.equal(sniffImageMime(jpg), "image/jpeg");
    assert.equal(sniffImageMime(webp), "image/webp");
    assert.equal(sniffImageMime(new Uint8Array(12)), null);
  });
});

describe("misc", () => {
  it("normalizes phones for dedup lookup (scenario 2)", () => {
    assert.equal(normalizePhone("+44 7700 900-111"), "+447700900111");
  });
  it("validates time input", () => {
    assert.ok(isValidTime("09:30"));
    assert.ok(!isValidTime("25:00"));
  });
});
