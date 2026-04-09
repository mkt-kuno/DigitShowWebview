import Plotly from 'plotly.js-cartesian-dist-min';
import type { ComponentType } from 'react';
import createPlotlyComponentModule from 'react-plotly.js/factory';

type FactoryModule = {
	default?: (plotly: unknown) => ComponentType<any>;
};

const factory = (
  typeof createPlotlyComponentModule === 'function'
    ? createPlotlyComponentModule
    : (createPlotlyComponentModule as unknown as FactoryModule).default
) as ((plotly: unknown) => ComponentType<any>) | undefined;

if (!factory) {
	throw new Error('react-plotly.js factory export is unavailable.');
}

const Plot = factory(Plotly);

export default Plot;
