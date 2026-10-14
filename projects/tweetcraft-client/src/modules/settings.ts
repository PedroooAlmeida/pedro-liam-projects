export const numberSetting = (label: string, value: number, min: number, max: number, step = 1) =>
  ({ label, kind: 'number', default: value, min, max, step } as const);
export const booleanSetting = (label: string, value: boolean) => ({ label, kind: 'boolean', default: value } as const);
