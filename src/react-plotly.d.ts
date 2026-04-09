declare module 'react-plotly.js/factory' {
  import { ComponentType } from 'react';
  import { Data, Layout, Config } from 'plotly.js';

  interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: unknown[];
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    onInitialized?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onPurge?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    className?: string;
    divId?: string;
  }

  export default function createPlotlyComponent(plotly: unknown): ComponentType<PlotParams>;
}

declare module 'react-plotly.js' {
  import { Component } from 'react';
  import { Data, Layout, Config } from 'plotly.js';

  interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: unknown[];
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    onInitialized?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onPurge?: (figure: { data: Data[]; layout: Partial<Layout> }, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    className?: string;
    divId?: string;
  }

  export default class Plot extends Component<PlotParams> {}
}
