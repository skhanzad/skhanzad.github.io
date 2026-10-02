import { useEffect } from 'react';
import { initPortfolio } from '../../assets/js/main.js';

export function usePortfolioEffects() {
  useEffect(() => initPortfolio(), []);
}
