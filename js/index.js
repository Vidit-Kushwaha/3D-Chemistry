var glviewer = null;
var fileData = null;
var labels = [];

$(document).ready(function () {
  let inputQuery = document.getElementById("query");
  let inputStyle = document.getElementById("style");
  let inputModel = document.getElementById("model");
  let inputToggle = document.getElementById("toggle");
  let inputFile = document.getElementById("file");
  let element = document.getElementsByClassName("subElement");

  if (
    inputQuery &&
    inputStyle &&
    inputModel &&
    inputToggle &&
    inputFile &&
    element
  ) {
    var validSpecs = $3Dmol.extend({}, atomSpec);
    $3Dmol.extend(validSpecs, otherExtra);
    loadMolecule(fileData || "");

    $("#myForm").submit(function (event) {
      event.preventDefault();

      const value = inputQuery.value;
      const style = inputStyle.value;
      const model = inputModel.value;

      const newUrl = `?id=${value.trim()}&style=${style}&model=${model}`;

      if (window.history && window.history.pushState) {
        window.history.pushState({}, "", newUrl);
      } else {
        window.location.href = newUrl;
      }
      loadMolecule(fileData || "");
    });

    $("#toggle").change(function (event) {
      if (inputToggle.checked) {
        addLabels();
        glviewer.render();
      } else {
        labels.forEach((atom) => {
          glviewer.removeLabel(atom._clickLabel);
          atom._clickLabel = null;
        });
      }
    });

    $("#file").change(function (event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          const data = e.target.result;
          const result = { data: data, ext: file.name.split(".").pop() };
          fileData = result;
          loadMolecule(result);
        };
        reader.readAsText(file);
      }
    });

    $("#model").change(function (event) {
      const model = event.target.value;
      if (model === "file") {
        element[1].removeAttribute("hidden");
        element[0].setAttribute("hidden", true);
      } else {
        element[1].setAttribute("hidden", true);
        element[0].removeAttribute("hidden");
      }
      if (window.history && window.history.pushState) {
        window.history.pushState({}, "", `?model=${model}`);
      } else {
        window.location.href = `?model=${model}`;
      }
    });

    function loadMolecule() {
      try {
        const queryString = window.location.search;

        if (queryString) {
          const paramsString = queryString.slice(1);

          const urlParams = new URLSearchParams(paramsString);

          var style = urlParams.get("style");
          var id = urlParams.get("id");
          var model = urlParams.get("model") ;
        }

        inputQuery.value = id || "";
        inputStyle.value = style || "";
        inputModel.value = model || "";

        if (model === "file") {
          element[1].removeAttribute("hidden");
          element[0].setAttribute("hidden", true);
        } else if(model == "cid" || model == "smiles" || model == "mmtf" || model == "cif" || model == "pdb") {
          element[1].setAttribute("hidden", true);
          element[0].removeAttribute("hidden");
        }

        if (glviewer === null) {
          glviewer = $3Dmol.createViewer("editor", {
            defaultcolors: $3Dmol.rasmolElementColors,
          });
          glviewer.setBackgroundColor(0xffffff);
        } else {
          glviewer.clear();
        }

        if (model === "cid") {
          model = "sdf";
        }
        if (style === "cartoon") {
          style = { cartoon: { color: "spectrum" } };
        }

        if (model === "file" && fileData) {
          const { data, ext } = fileData;
          if (ext === "cjson") {
            const parsedAtoms = parseChemicalJson(data);
            const m = glviewer.addModel();
            m.addAtoms(parsedAtoms);
          } else if (ext === "pdb") {
            glviewer.addModel(data, ext);
          }
          processCommands(glviewer, style ? style : "stick");
          glviewer.zoomTo();
          glviewer.render();
        } else {
          const url = getFetchUrl(model, id);
          $.get(url.replace("+", ""), function (ret, txt, response) {
            glviewer.addModel(ret, model);
            processCommands(glviewer, style ? style : "stick");
            glviewer.zoomTo();
            glviewer.render();
          }).fail(function () {
            console.log("Failed to fetch " + url);
          });
        }
 
  
      } catch (e) {
        console.log(e);
      }
    }
  }
});

function render() {
  glviewer.setStyle({});
  processCommands(glviewer);
  glviewer.render();
}

function getAtomLabel(atom) {
  let label = atom.elem;
  if (atom.resn && atom.resi) {
    label = atom.resn + atom.resi + ":" + atom.atom;
  }
  return label;
}

function processCommands(viewer, style) {
  let hoverLabel = null;
  let lastClicked = null;

  viewer.setStyle({}, $3Dmol.specStringToObject(style || "stick"));

  // Hover atom label management
  viewer.setHoverable(
    {},
    true,
    function onHover(atom) {
      if (!atom._clickLabel) {
        const label = getAtomLabel(atom);
        hoverLabel = viewer.addLabel(label, {
          position: atom,
          fontSize: 26,
          backgroundColor: "black",
          backgroundOpacity: 0.75,
          alignment: "bottomCenter",
        });
        viewer.render();
      }
    },
    function onUnhover() {
      if (hoverLabel) {
        viewer.removeLabel(hoverLabel);
        hoverLabel = null;
        viewer.render();
      }
    }
  );

  viewer.setClickable({}, true, function onClick(atom) {
    if (hoverLabel) {
      viewer.removeLabel(hoverLabel);
      hoverLabel = null;
    }
    if (!lastClicked) {
      const label = getAtomLabel(atom);
      atom._clickLabel = viewer.addLabel(label, {
        position: atom,
        fontSize: 26,
        backgroundColor: "black",
        backgroundOpacity: 0.75,
        alignment: "bottomCenter",
      });
      lastClicked = atom;
    } else {
      viewer.removeLabel(lastClicked._clickLabel);
      lastClicked._clickLabel = null;

      if (lastClicked !== atom) {
        const start = new $3Dmol.Vector3(
          lastClicked.x,
          lastClicked.y,
          lastClicked.z
        );
        const end = new $3Dmol.Vector3(atom.x, atom.y, atom.z);
        let distanceLabel = null;

        viewer.addCylinder({
          dashed: true,
          radius: 0.05,
          dashLength: 0.25,
          gapLength: 0.15,
          start: start,
          end: end,
          fromCap: 2,
          toCap: 2,
          color: "red",
          clickable: true,
          callback: function onCylinderClick(shape) {
            viewer.removeShape(shape);
            viewer.removeLabel(distanceLabel);
          },
        });

        const distance = $3Dmol.GLShape.distance_from(start, end);
        const midPoint = start.add(end).multiplyScalar(0.5);
        distanceLabel = viewer.addLabel(distance.toFixed(3), {
          position: midPoint,
          fontSize: 16,
          backgroundColor: "red",
          backgroundOpacity: 0.75,
          alignment: "bottomCenter",
        });
      }
      lastClicked = null;
    }
    viewer.render();
  });
}

function getFetchUrl(type, value = 217) {
  const pubchemBaseUrl =
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/";
  const cactusBaseUrl = "https://cactus.nci.nih.gov/chemical/structure/";
  const mmtfBaseUrl = "https://mmtf.rcsb.org/v1.0/full/";
  const rcsbBaseUrl = "https://files.rcsb.org/view/";

  function constructUrl(src, value) {
    switch (src) {
      case "cid":
        return pubchemBaseUrl + value + "/SDF?record_type=3d";
      case "smiles":
        return cactusBaseUrl + encodeURIComponent(value) + "/file?format=sdf";
      case "mmtf":
        return mmtfBaseUrl + value;
      case "cif":
        return rcsbBaseUrl + value + ".cif";
      case "pdb":
        return rcsbBaseUrl + value + ".pdb";
      default:
        return pubchemBaseUrl + 217 + "/SDF?record_type=3d";
    }
  }

  return constructUrl(type, value.trim());
}

function parseChemicalJson(jsonData) {
  const data = JSON.parse(jsonData);

  if (!data || !data.atoms || !data.atoms.coords || !data.atoms.elements) {
    throw new Error("Invalid chemical JSON format. Missing required fields.");
  }

  const atoms = [];
  const coords = data.atoms.coords["3d"];
  const elements = data.atoms.elements.number;
  const formalCharges = data.atoms.formalCharges || [];
  const partialCharges = data.partialCharges?.Gasteiger || [];

  for (let i = 0; i < coords.length / 3; i++) {
    const atom = {
      x: coords[i * 3],
      y: coords[i * 3 + 1],
      z: coords[i * 3 + 2],
      elem: getElementalSymbol(elements[i]),
      formalCharge: formalCharges[i] || 0,
      partialCharge: partialCharges[i] || 0,
      bonds: [],
      bondOrder: [],
    };
    atoms.push(atom);
  }

  const bonds = data.bonds.connections.index;
  const bondOrders = data.bonds.order;

  for (let i = 0; i < bonds.length; i += 2) {
    const atom1Index = bonds[i];
    const atom2Index = bonds[i + 1];
    const order = bondOrders[i / 2];

    atoms[atom1Index].bonds.push(atom2Index);
    atoms[atom1Index].bondOrder.push(order);

    atoms[atom2Index].bonds.push(atom1Index);
    atoms[atom2Index].bondOrder.push(order);
  }

  return atoms;
}

function getElementalSymbol(elementNumber) {
  const elements = [
    "X",
    "H",
    "He",
    "Li",
    "Be",
    "B",
    "C",
    "N",
    "O",
    "F",
    "Ne",
    "Na",
    "Mg",
    "Al",
    "Si",
    "P",
    "S",
    "Cl",
    "Ar",
  ];
  return elementNumber >= 0 && elementNumber < elements.length
    ? elements[elementNumber]
    : "X";
}

function addLabels() {
  const atoms = glviewer.getModel().selectedAtoms();

  atoms.forEach((atom) => {
    const label = getAtomLabel(atom);
    atom._clickLabel = glviewer.addLabel(label, {
      position: atom,
      fontSize: 26,
      backgroundColor: "black",
      backgroundOpacity: 0.9,
      alignment: "bottomCenter",
    });
    labels.push(atom);
  });
}
