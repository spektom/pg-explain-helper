function parsePlan(text) {
  function addInfo(node, text) {
    function parseValues(values) {
      return (values.match(/([\w ]+)=([^ \)]+)/g) || []).reduce(function(m, v) {
        const r = v.split('=');
        const key = r[0].trim().replace(' ', '_');
        const value = r[1];
        if (value.indexOf('..') != -1) {
          const values = value.split('..');
          m[key] = { start: parseFloat(values[0]), total: parseFloat(values[1]) };
        } else {
          m[key] = parseFloat(value);
        }
        return m;
      }, {});
    }

    const m = text.match(/\(.*?\)/g);
    if (m) {
      const estimate = parseValues(m[0]);
      if (Object.keys(estimate).length > 0) {
        node.estimate = estimate;
      }
      if (m.length > 1) {
        node.actual = parseValues(m[1]);
      }
    }
    node.info.push(text.trim());
  }

  function newNode(indent, text) {
    const node = { children: [], info: [], indent: indent || 0 };
    if (text) {
      addInfo(node, text);
    }
    return node;
  }

  function findNode(indent, node) {
    node = node || planTree;
    if (node.children.length == 0 || node.children[node.children.length - 1].indent >= indent) {
      return node;
    }
    return findNode(indent, node.children[node.children.length - 1]);
  }

  const planTree = newNode();

  text.split(/[\r\n]+/).forEach(function(line) {
    const indent = line.match(/^\s*/)[0].length;
    if (line.match(/^\s+->/)) {
      findNode(indent).children.push(newNode(indent, line));
    } else {
      addInfo(findNode(indent), line);
    }
  });

  return planTree;
}

function createFlameGraph(plan, valueFn, component) {
  function getName(node) {
    return node.info[0]
      .split('(')[0].replace(/^\W+/, '')
      .replace(/\s[a-z].*/, '').trim();
  }

  function convertNodes(node) {
    const fgNode = { name: getName(node), value: valueFn(node), children: [] };
    for (var i = 0; i < node.children.length; ++i) {
      fgNode.children[i] = convertNodes(node.children[i]);
    }
    return fgNode;
  }

  const fgNode = convertNodes(plan);
  if (!fgNode.value) {
    $(component).html('').parents('.chart-wrapper').addClass('invisible');
  } else {
    $(component).html('').parents('.chart-wrapper').removeClass('invisible');

    const tip = d3.tip()
      .attr('class', 'd3-flame-graph-tip')
      .html(function(d) {return d.data.name + ' (total time: ' + d.data.value + 'ms)'; });

    const flamegraph = d3.flamegraph().width($('textarea').width()).tooltip(tip);
    d3.select(component).datum(fgNode).call(flamegraph);
  }
}

function evaluatePlan() {
  const plan = parsePlan($('textarea').val());

  createFlameGraph(plan, function(node) {
    return node.estimate.cost.total;
  }, '#estimate-chart');

  createFlameGraph(plan, function(node) {
    if (typeof(node.actual) !== 'undefined') {
      return node.actual.actual_time.total;
    }
  }, '#actual-chart');
}
