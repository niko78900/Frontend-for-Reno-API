import { ContractorExpertise } from '../models/project.model';

export interface EtaInputs {
  baseEtaWeeks?: number | null;
  workers?: number | null;
  progressPercent?: number | null;
  expertise?: ContractorExpertise;
}

export function calculateEtaDays({
  baseEtaWeeks,
  workers,
  progressPercent,
  expertise
}: EtaInputs): number | undefined {
  const baseWeeks = toNumber(baseEtaWeeks);
  if (baseWeeks <= 0) {
    return undefined;
  }

  const baseDays = baseWeeks * 7;
  const expertiseOffset = getExpertiseOffset(expertise);
  const etaAfterExpertise = baseDays + expertiseOffset;
  const workerCount = Math.max(0, Math.round(toNumber(workers)));
  const workerDelta = workerCount - 1;
  const etaAfterWorkers = etaAfterExpertise - (0.4 * workerDelta);
  const progressFraction = clampProgressFraction(toNumber(progressPercent));
  const adjustedBase = Math.max(0, etaAfterWorkers);
  const etaDays = adjustedBase * (1 - progressFraction);

  const result = Math.max(0, Math.ceil(etaDays));
  return result;
}

function clampProgressFraction(progress: number): number {
  const fraction = progress / 100;
  if (Number.isNaN(fraction)) {
    return 0;
  }
  return Math.min(0.99, Math.max(0, fraction));
}

function getExpertiseOffset(expertise?: ContractorExpertise): number {
  switch (expertise) {
    case 'JUNIOR':
      return 7;
    case 'SENIOR':
      return -7;
    case 'APPRENTICE':
    default:
      return 0;
  }
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}
