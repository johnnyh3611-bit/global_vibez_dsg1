import { findSeoConfig, normalizeSeoPathname } from "../routeSeoConfig";

describe("RouteSeo helpers", () => {
  test("normalizes trailing slashes to the canonical pathname", () => {
    expect(normalizeSeoPathname("/beta/")).toBe("/beta");
    expect(normalizeSeoPathname("/terms-of-service/")).toBe("/terms-of-service");
    expect(normalizeSeoPathname("/")).toBe("/");
  });

  test("maps alias routes to their canonical SEO entry", () => {
    const betaConfig = findSeoConfig(normalizeSeoPathname("/beta/"));
    const termsConfig = findSeoConfig(normalizeSeoPathname("/terms-of-service/"));
    const listingConfig = findSeoConfig(normalizeSeoPathname("/yellow-pages/sample-listing/"));

    expect(betaConfig?.canonicalPath).toBe("/beta-tester");
    expect(termsConfig?.canonicalPath).toBe("/terms");
    expect(betaConfig?.robots).toBeUndefined();
    expect(listingConfig?.canonicalPath).toBe("/yellow-pages/sample-listing");
  });

  test("keeps utility routes noindexed", () => {
    const authConfig = findSeoConfig(normalizeSeoPathname("/login/"));
    const yellowPagesCreateConfig = findSeoConfig(normalizeSeoPathname("/yellow-pages/new/"));
    const yellowPagesCreateChildConfig = findSeoConfig(normalizeSeoPathname("/yellow-pages/new/step-2/"));

    expect(authConfig?.robots).toBe("noindex,nofollow");
    expect(yellowPagesCreateConfig?.robots).toBe("noindex,nofollow");
    expect(yellowPagesCreateChildConfig?.robots).toBe("noindex,nofollow");
  });
});
