import { mergeTests } from "playwright/test";
import { rillCloud } from "@statsparrot/web-common/tests/fixtures/statsparrot-cloud-fixtures";
import { rillDev } from "@statsparrot/web-common/tests/fixtures/statsparrot-dev-fixtures";

export const test = mergeTests(rillDev, rillCloud);
