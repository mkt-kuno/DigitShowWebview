/// <reference types="vite/client" />

declare module 'react-plotly.js';

declare module 'plotly.js/lib/core' {
  interface PlotlyCore {
    register: (modules: unknown[]) => void;
  }
  const Plotly: PlotlyCore;
  export default Plotly;
}

declare module 'plotly.js/lib/scattergl' {
  const trace: unknown;
  export default trace;
}

declare module 'react-plotly.js/factory' {
  const createPlotlyComponent: (plotly: unknown) => import('react').ComponentType<any>;
  export default createPlotlyComponent;
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_DEP_VERSIONS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}