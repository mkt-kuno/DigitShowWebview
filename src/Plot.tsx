import Plotly from 'plotly.js/lib/core';
import scatter from 'plotly.js/lib/scatter';
import scattergl from 'plotly.js/lib/scattergl';
import type { ComponentType } from 'react';
import createPlotlyComponentModule from 'react-plotly.js/factory';

Plotly.register([scatter, scattergl]);

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
