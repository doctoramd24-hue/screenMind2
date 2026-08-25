
export const getTagColor = (tag: string) => {
  const presets: Record<string, { bg: string, text: string, border: string }> = {
    'Идеи': { bg: '#fff7ed', text: '#ea580c', border: '#f97316' },
    'Проекты': { bg: '#eef2ff', text: '#4f46e5', border: '#6366f1' },
    'Личное': { bg: '#fdf2f8', text: '#db2777', border: '#ec4899' },
    'Работа': { bg: '#f0fdf4', text: '#16a34a', border: '#22c55e' },
    'Важное': { bg: '#fef2f2', text: '#dc2626', border: '#ef4444' },
    'Учеба': { bg: '#f5f3ff', text: '#7c3aed', border: '#8b5cf6' },
    'Срочно': { bg: '#fffce8', text: '#ca8a04', border: '#eab308' },
  };

  if (presets[tag]) return presets[tag];

  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const h = Math.abs(hash % 360);
  return {
    bg: `hsla(${h}, 80%, 96%, 1)`,
    text: `hsla(${h}, 75%, 25%, 1)`,
    border: `hsla(${h}, 65%, 45%, 1)`
  };
};
