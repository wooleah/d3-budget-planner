const dims = { height: 300, width: 300, radius: 150 };
const cent = { x: dims.width / 2 + 5, y: dims.height / 2 + 5 };

const svg = d3
  .select(".canvas")
  .append("svg")
  .attr("width", dims.width + 150) // for the legend
  .attr("height", dims.height + 150);

const graph = svg.append("g").attr("transform", `translate(${cent.x}, ${cent.y})`);

const pie = d3
  .pie()
  .sort(null)
  .value((d) => d.cost);

// arc generator
const arcPath = d3
  .arc()
  .outerRadius(dims.radius)
  .innerRadius(dims.radius / 2);

const colour = d3.scaleOrdinal(d3["schemeSet2"]);

// legend setup
const legendGroup = svg.append("g").attr("transform", `translate(${dims.width + 40}, 10)`);
const legend = d3.legendColor().shape("circle").shapePadding(10).scale(colour);

// tooltip setup
const tip = d3
  .tip()
  .attr("class", "tip card")
  .html((d) => {
    let content = `<div class="name">${d.data.name}</div>`;
    content += `<div class="cost">${d.data.cost}</div>`;
    content += `<div class="delete">Click slice to delete</div>`;
    return content;
  });

graph.call(tip);

// update function
const update = (data) => {
  // update color scale domain
  colour.domain(data.map((d) => d.name));

  // update and call legend
  legendGroup.call(legend);
  legendGroup.selectAll("text").attr("fill", "white");

  // join enhanced(pie) data to path elements
  // paths won't be here when we call selectAll, so all we're doing is make virtual paths and join data
  // then access enter selection and append to the DOM
  // also you don't need to specify d => arcPath(d), it automatically passed d to the arcPath
  // *d for draw
  const paths = graph.selectAll("path").data(pie(data));

  // handle the exit selection
  paths.exit().transition().duration(750).attrTween("d", arcTweenExit).remove();

  // handle the current and enter DOM path updates
  // d is what makes path big or small
  paths.attr("d", arcPath).transition().duration(750).attrTween("d", arcTweenUpdate);

  paths
    .enter()
    .append("path")
    .attr("class", "arc")
    .attr("stroke", "#fff")
    .attr("stroke-width", 3)
    .attr("fill", (d) => colour(d.data.name))
    .each(function (d) {
      this._current = d;
    })
    .transition()
    .duration(750)
    .attrTween("d", arcTweenEnter);

  // add events
  graph
    .selectAll("path")
    .on("mouseover", (d, i, n) => {
      tip.show(d, n[i]);
      handleMouseover(d, i, n);
    })
    .on("mouseout", (d, i, n) => {
      tip.hide();
      handleMouseout(d, i, n);
    })
    .on("click", handleClick);
};

// data array and firestore
let data = [];

db.collection("expenses").onSnapshot((res) => {
  res.docChanges().forEach((change) => {
    const doc = { ...change.doc.data(), id: change.doc.id };
    if (change.type === "added") {
      data.push(doc);
    }
    if (change.type === "modified") {
      const index = data.findIndex((item) => item.id === doc.id);
      data[index] = doc;
    }
    if (change.type === "removed") {
      data = data.filter((item) => item.id !== doc.id);
    }
  });

  update(data);
});

const arcTweenEnter = (d) => {
  const i = d3.interpolate(d.endAngle, d.startAngle);

  return function (t) {
    // only change the startAngle(which is the end here) accordingly
    d.startAngle = i(t);
    // then recalculate the path for that arc
    return arcPath(d);
  };
};

const arcTweenExit = (d) => {
  // in the beginning at 0, it'll be the end(startAngle), and over time it'll get smaller and smaller to endAngle
  const i = d3.interpolate(d.startAngle, d.endAngle);

  return function (t) {
    d.startAngle = i(t);
    return arcPath(d);
  };
};

// use function keyword to allow use of this
function arcTweenUpdate(d) {
  // interpolate between the two objects
  const i = d3.interpolate(this._current, d);
  console.log(this);

  // update the current prop with new updated data
  this._current = d;
  return function (t) {
    return arcPath(i(t));
  };
}

// evene handlers
function handleMouseover(d, i, n) {
  d3.select(n[i]).transition("changeSliceFill").duration(300).attr("fill", "#fff");
}

function handleMouseout(d, i, n) {
  d3.select(n[i]).transition("changeSliceFill").duration(300).attr("fill", colour(d.data.name));
}

function handleClick(d, i, n) {
  const id = d.data.id;
  db.collection("expenses").doc(id).delete();
}
