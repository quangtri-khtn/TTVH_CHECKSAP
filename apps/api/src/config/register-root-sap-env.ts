// Side-effect nạp 3 biến môi trường SAP từ file .env gốc của monorepo vào process.env.
// QUY TẮC CỨNG: File này CHỈ được import từ apps/api/src/main.ts.
// Cấm import từ app.module.ts, env.schema.ts, scripts/generate-openapi.ts hay bất kỳ
// file nào Jest nạp để tránh rò rỉ biến môi trường thật vào test và codegen.
import { loadRootSapEnv } from './load-root-sap-env';

loadRootSapEnv(__dirname, process.env);
