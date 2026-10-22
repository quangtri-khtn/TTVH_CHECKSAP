// DTO kết quả kiểm tra 3 bước kết nối SAP (khớp kiểu SapCheckStep ở lib/sap-check-steps.ts).
import { ApiProperty } from '@nestjs/swagger';
import {
  SAP_CHECK_STEP_KEYS,
  SAP_CHECK_STEP_STATUSES,
  type SapCheckStep,
  type SapCheckStepKey,
  type SapCheckStepStatus,
} from '../lib/sap-check-steps';

export class SapConnectionTestStepDto implements SapCheckStep {
  @ApiProperty({
    enum: SAP_CHECK_STEP_KEYS,
    enumName: 'SapConnectionTestStepKey',
  })
  key!: SapCheckStepKey;

  @ApiProperty()
  label!: string;

  @ApiProperty({
    enum: SAP_CHECK_STEP_STATUSES,
    enumName: 'SapConnectionTestStepStatus',
  })
  status!: SapCheckStepStatus;

  @ApiProperty({ required: false })
  message?: string;
}

export class SapConnectionTestResultDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty({ type: [SapConnectionTestStepDto] })
  steps!: SapConnectionTestStepDto[];

  @ApiProperty()
  durationMs!: number;
}
