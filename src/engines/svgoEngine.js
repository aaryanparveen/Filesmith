import { optimize } from 'svgo';

export function optimizeSVG(svgString, quality = 75) {
  const plugins = [
    'removeDoctype',
    'removeXMLProcInst',
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'cleanupAttrs',
    'mergeStyles',
    'inlineStyles',
    'minifyStyles',
    'cleanupIds',
    'removeUselessDefs',
    'cleanupNumericValues',
    'convertColors',
    'removeUnknownsAndDefaults',
    'removeNonInheritableGroupAttrs',
    'removeUselessStrokeAndFill',
    'removeViewBox',
    'cleanupEnableBackground',
    'removeHiddenElems',
    'removeEmptyText',
    'convertShapeToPath',
    'convertEllipseToCircle',
    'moveElemsAttrsToGroup',
    'moveGroupAttrsToElems',
    'collapseGroups',
    'convertTransform',
    'removeEmptyAttrs',
    'removeEmptyContainers',
    'mergePaths',
    'removeUnusedNS',
    'sortDefsChildren',
    'removeTitle',
    'removeDesc',
  ];

  if (quality < 50) {
    plugins.push('removeDimensions');
    plugins.push({
      name: 'cleanupNumericValues',
      params: { floatPrecision: 1 },
    });
  } else if (quality < 75) {
    plugins.push({
      name: 'cleanupNumericValues',
      params: { floatPrecision: 2 },
    });
  }

  const result = optimize(svgString, {
    multipass: true,
    plugins,
  });

  return result.data;
}
