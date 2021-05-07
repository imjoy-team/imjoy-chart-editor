import React, { Component } from "react";
import plotly from "plotly.js/dist/plotly";
import PlotlyEditor from "react-chart-editor";
import CustomEditor from "./CustomEditor";
import "react-chart-editor/lib/react-chart-editor.css";
import { imjoyRPC } from "imjoy-rpc";
import * as Papa from "papaparse";

const config = { editable: true };

function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      error: (err, file, inputElem, reason) => {
        alert("Falied to load the table: " + reason.toString());
        reject(reason);
      },
      complete: (results) => {
        resolve(transpose(results.data));
      },
    });
  });
}

function transpose(data) {
  let result = {};
  for (let row of data) {
    for (let [key, value] of Object.entries(row)) {
      result[key] = result[key] || [];
      result[key].push(value);
    }
  }
  return result;
}

function randId() {
  return "_" + Math.random().toString(36).substr(2, 9);
}

function getUrlParameter(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
  var results = regex.exec(location.search);
  return results === null
    ? ""
    : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function cleanUpPoints(points) {
  const data = [];
  for (let i = 0; i < points.length; i++) {
    data.push({
      x: points[i].x,
      y: points[i].y,
      z: points[i].z || undefined,
    });
  }
  return data;
}
class App extends Component {
  constructor() {
    super();
    this.plotDivId = randId();
    let load = getUrlParameter("load");
    this.saveDataHandler = null;
    if (load) {
      loadCSV(load).then((data) => {
        this.dataSources = data;
        this.dataSourceOptions = Object.keys(this.dataSources).map((name) => ({
          value: name,
          label: name,
        }));
        this.forceUpdate();
      });
    } else {
      this.dataSources = {
        col1: [1, 2, 3], // eslint-disable-line no-magic-numbers
        col2: [4, 3, 2], // eslint-disable-line no-magic-numbers
        col3: [17, 13, 9], // eslint-disable-line no-magic-numbers
      };

      this.dataSourceOptions = Object.keys(this.dataSources).map((name) => ({
        value: name,
        label: name,
      }));
    }
    this.state = {
      data: [],
      layout: {},
      frames: [],
    };
    // if inside an iframe, setup imjoy rpc
    if (window.self !== window.top) {
      const self = this;
      imjoyRPC.setupRPC({ name: "ImJoy Chart Editor" }).then((api) => {
        api.export({
          setup() {
            console.log("imjoy-rpc initialized.");
          },
          run(ctx) {
            if (ctx && ctx.config) {
              self.saveDataHandler = ctx.config.saveDataHandler;
            }
            if (ctx && ctx.data) {
              self.setState(ctx.data);
              self.dataSources = ctx.data.dataSources || {};
              self.dataSourceOptions =
                ctx.data.dataSourceOptions ||
                Object.keys(self.dataSources).map((name) => ({
                  value: name,
                  label: name,
                }));
              if (self.state.dataSources) delete self.data.dataSources;
              if (self.state.dataSourceOptions)
                delete self.data.dataSourceOptions;
            }
            self.forceUpdate();
          },
          setState(state) {
            self.setState(state);
            self.forceUpdate();
          },
          getState() {
            return self.state;
          },
          on(event, handler) {
            document.getElementById(this.plotDivId).on(event, (data) => {
              if (data.points) handler(cleanUpPoints(data.points));
              else {
                handler(data);
              }
            });
          },
          off(event) {
            document.getElementById(this.plotDivId).removeAllListeners(event);
          },
        });
      });
    }
  }

  async loadData(file) {
    if (typeof file === "string") {
      if (file.split("?")[0].endsWith(".json")) {
        const response = await fetch(file);
        const data = await response.json();
        if (data.data && data.layout) {
          this.setState(data);
          this.forceUpdate();
        } else {
          throw new Error("Invalid file type");
        }
      } else if (!file.split("?")[0].endsWith(".csv")) {
        throw new Error(
          "Invalid file extension, only .json and .csv are supported"
        );
      }
    } else if (file instanceof Blob) {
      if (file.name.endsWith(".json")) {
        const fr = new FileReader();
        fr.addEventListener("load", (e) => {
          const data = JSON.parse(fr.result);
          if (data.data && data.layout) {
            this.setState(data);
            this.forceUpdate();
          } else {
            throw new Error("Invalid file type");
          }
        });

        fr.readAsText(file);
      }
    }
    const data = await loadCSV(file);
    this.dataSources = data;
    this.dataSourceOptions = Object.keys(this.dataSources).map((name) => ({
      value: name,
      label: name,
    }));
    this.forceUpdate();
  }

  render() {
    return (
      <div className="app">
        <PlotlyEditor
          data={this.state.data}
          layout={this.state.layout}
          config={config}
          frames={this.state.frames}
          dataSources={this.dataSources}
          dataSourceOptions={this.dataSourceOptions}
          plotly={plotly}
          onUpdate={(data, layout, frames) => {
            this.setState({ data, layout, frames });
          }}
          useResizeHandler
          debug
          glByDefault
          showFieldTooltips
          advancedTraceTypeSelector
          divId={this.plotDivId}
        >
          <CustomEditor
            logoSrc={"./static/icons/favicon-96x96.png"}
            dataSources={this.dataSources}
            divId={this.plotDivId}
            data={this.state}
            handleSaveData={this.saveDataHandler}
            handleLoadData={this.loadData.bind(this)}
          />
        </PlotlyEditor>
      </div>
    );
  }
}

export default App;
