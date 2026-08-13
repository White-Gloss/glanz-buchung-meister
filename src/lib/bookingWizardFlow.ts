export function stepAfterPackageSelection(currentStep: number): number {
  return currentStep === 0 ? 1 : currentStep;
}
