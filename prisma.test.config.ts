import { defineConfig } from "prisma/config";

import { loadTestDatabaseUrl } from "./tests/support/test-database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: loadTestDatabaseUrl(),
  },
});