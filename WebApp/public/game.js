export const LEVELS = {
  beginner: { label: '初級', command: 0, demoMs: 1800, answerMs: 5000 },
  advanced: { label: '上級', command: 1, demoMs: 1050, answerMs: 5000 }
};

export function judge(confidence) {
  if (confidence >= .85) return { mark: '◎', points: 100, label: '二重丸' };
  if (confidence >= .65) return { mark: '○', points: 80, label: '丸' };
  if (confidence >= .4) return { mark: '△', points: 50, label: '三角' };
  return { mark: '×', points: 0, label: 'ざんねん' };
}

export function averageConfidence(samples) {
  if (samples.length === 0) return 0;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

export function scoredConfidenceAverage(samples) {
  return averageConfidence(samples.slice(1));
}

export function finalGrade(total) {
  if (total >= 340) return 'PERF';
  if (total >= 260) return 'GOOD';
  if (total >= 160) return 'SOSO';
  return 'UNN.';
}

export function finalPointCount(total) {
  return Math.max(0, Math.min(4, Math.round(total / 100)));
}

export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
