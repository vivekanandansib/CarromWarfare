// Board palettes: explicit per-theme paint (no CSS-dependent SVG theming,
// which paints inconsistently across renderers). Board/FlickBoard take one.
export type BoardThemeName = 'classic' | 'midnight' | 'royal' | 'kingdom';

export interface BoardPalette {
  woodHi: string;
  woodMid: string;
  woodLo: string;
  feltHi: string;
  feltLo: string;
  grainFrame: string;
  grainFelt: string;
  frameLine: string;
  flourish: string;
  designRing: string;
  centerRed: string;
  centerDark: string;
  arrow: string;
  diagonal: string;
  strikerBase: string;
}

export const PALETTES: Record<BoardThemeName, BoardPalette> = {
  classic: {
    woodHi: '#c98d4e', woodMid: '#a96f35', woodLo: '#7c4f22',
    feltHi: '#f3d9a4', feltLo: '#dfb26e',
    grainFrame: '#7c4f22', grainFelt: '#dfb26e',
    frameLine: '#e8c47c', flourish: '#e8c47c',
    designRing: '#b03030', centerRed: '#b03030', centerDark: '#26211c',
    arrow: '#b03030', diagonal: '#8e2626',
    strikerBase: '#f0e2c4',
  },
  midnight: {
    woodHi: '#4a5f96', woodMid: '#2c3a5e', woodLo: '#141b31',
    feltHi: '#a5e3f2', feltLo: '#54a3c2',
    grainFrame: '#232c47', grainFelt: '#5aa7c4',
    frameLine: '#7ef0ff', flourish: '#7ef0ff',
    designRing: '#7ef0ff', centerRed: '#7ef0ff', centerDark: '#0a0f22',
    arrow: '#7ef0ff', diagonal: '#3f6d84',
    strikerBase: '#d8ecf4',
  },
  royal: {
    woodHi: '#a54451', woodMid: '#72222d', woodLo: '#3d0f15',
    feltHi: '#f4ddab', feltLo: '#d3a055',
    grainFrame: '#6b1f2a', grainFelt: '#d9a45f',
    frameLine: '#ffd54a', flourish: '#ffd54a',
    designRing: '#ffd54a', centerRed: '#b03030', centerDark: '#3d0f15',
    arrow: '#ffd54a', diagonal: '#8e2626',
    strikerBase: '#f0e2c4',
  },
  kingdom: {
    woodHi: '#5a4230', woodMid: '#33241a', woodLo: '#14100c',
    feltHi: '#f2dca9', feltLo: '#d3a761',
    grainFrame: '#241a12', grainFelt: '#d9b06e',
    frameLine: '#d4af37', flourish: '#d4af37',
    designRing: '#d4af37', centerRed: '#c8102e', centerDark: '#14100c',
    arrow: '#d4af37', diagonal: '#7a5c14',
    strikerBase: '#1b1512',
  },
};
