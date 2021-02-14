/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog4/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog4/ellipsoids.json"; // ellipsoids file loc
var defaultEye = vec3.fromValues(0.5,1,-1.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,1,1.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(0.5,1.5,-3); // default light position
var temp = vec3.create();

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0; // how much to displace view with each key press

var cubeStart = 2;  // index of cube stuff
var numTet = 0;   // total number of cubes to render
var cubeArray = [];

var field;
var fWidth = 1; // Width of feild
var fHeight = fWidth * 2;    // Height of field
var startX = 0.625;
var startY = 2.475-.1;
var fIndex = 0; // index of field in buffers

var grid;
var gridOffset = .025;
var gridIndex = 1;  // index of the grid in buffers

var xLimit = fWidth * 10;   // x limit on grid
var yLimit = fHeight * 10;  // y limit on grid

var live;   // live tetromino
var gameOver = false;

var makeFunctions = [];
var gridArray = [];
for (var y=0; y<yLimit; y++) {
    gridArray[y] = [];
    for (var x=0; x<xLimit; x++) {
        gridArray[y][x] = false;
    }
}

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var alphaULoc;  // where to put the alpha value for the fragment shader

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

// ASSIGNMENT HELPER FUNCTIONS

function printGrid() {
    var string = "";
    for (var y=yLimit-1; y>=0; y--) {
        for (var x=xLimit-1; x>=0; x--) {
            if (gridArray[y][x])
                string += "X ";
            else
                string += ". ";
        }
        string += '\n';
    }
    console.log(string);
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try

    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// does stuff when keys are pressed
function handleKeyDown(event) {
    handleKeyDown.modelOn = live;

    function translateModel(cur,offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(cur.translation,cur.translation,offset);
    } // end translate model

    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

    switch (event.code) {

        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,viewDelta));
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,-viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,-viewDelta));
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,viewDelta));
            } // end if shift not pressed
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,-viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
            } // end if shift not pressed
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
            } // end if shift not pressed
            break;
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye,defaultEye);
            Center = vec3.copy(Center,defaultCenter);
            Up = vec3.copy(Up,defaultUp);
            break;

        // model transformation
        case "ArrowRight": // translate left
            var movable = true; // assume movable
            for (var i=0; i<handleKeyDown.modelOn.cubes.length; i++) {
                if (movable) {
                    var cur = handleKeyDown.modelOn.cubes[i];
                    var x = cur.x;
                    var y = cur.y;
                    if (x <= 0)
                        movable = false;
                    else
                        movable = !gridArray[y][x-1];  // check grid in direction asked
                }
            }
            if (movable)    // if still movable, move all cubes
                for (var i=0; i<handleKeyDown.modelOn.cubes.length; i++) {
                    var cur = handleKeyDown.modelOn.cubes[i];
                    translateModel(cur,vec3.scale(temp,vec3.fromValues(-1,0,0),.1+gridOffset));
                    cur.x--;
                }
            break;
        case "ArrowLeft": // translate right
            var movable = true; // assume movable
            for (var i=0; i<handleKeyDown.modelOn.cubes.length; i++) {
                if (movable) {
                    var cur = handleKeyDown.modelOn.cubes[i];
                    var x = cur.x;
                    var y = cur.y;
                    if (x >= xLimit-1)
                        movable = false;
                    else
                        movable = !gridArray[y][x+1];  // check grid in direction asked
                }
            }
            if (movable)    // if still movable, move all cubes
                for (var i=0; i<handleKeyDown.modelOn.cubes.length; i++) {
                    var cur = handleKeyDown.modelOn.cubes[i];
                    translateModel(cur,vec3.scale(temp,vec3.fromValues(-1,0,0),-.1-gridOffset));
                    cur.x++;
                }
            break;
        case "ArrowDown": // translate down
            var movable = true; // assume movable
            for (var i=0; i<handleKeyDown.modelOn.cubes.length; i++) {
                if (movable) {
                    var cur = handleKeyDown.modelOn.cubes[i];
                    var x = cur.x;
                    var y = cur.y;
                    if (y <= 0)
                        movable = false;
                    else
                        movable = !gridArray[y-1][x];  // check grid in direction asked
                }
            }
            if (movable)    // if still movable, move all cubes
                for (var i=0; i<handleKeyDown.modelOn.cubes.length; i++) {
                    var cur = handleKeyDown.modelOn.cubes[i];
                    translateModel(cur,vec3.scale(temp,vec3.fromValues(0,1,0),-.1-gridOffset));
                    cur.y--;
                }
            break;
        case "ArrowUp": // rotate 90deg
            handleKeyDown.modelOn.rotate();
            break;
        case "Space":
            var movable = true;
            while (movable) {
                for (var i=0; i<handleKeyDown.modelOn.cubes.length; i++) {
                    if (movable) {
                        var cur = handleKeyDown.modelOn.cubes[i];
                        var x = cur.x;
                        var y = cur.y;
                        if (y <= 0)
                            movable = false;
                        else
                            movable = !gridArray[y-1][x];  // check grid in direction asked
                    }
                }
                if (movable)    // if still movable, move all cubes
                    for (var i=0; i<handleKeyDown.modelOn.cubes.length; i++) {
                        var cur = handleKeyDown.modelOn.cubes[i];
                        translateModel(cur,vec3.scale(temp,vec3.fromValues(0,1,0),-.1-gridOffset));
                        cur.y--;
                    }
            }
            break;
    } // end switchz
} // end handleKeyDown

// set up the webGL environment
function setupWebGL() {

    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed


    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
      var cw = imageCanvas.width, ch = imageCanvas.height;
      imageContext = imageCanvas.getContext("2d");

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it

    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try

    catch(e) {
      console.log(e);
    } // end catch

} // end setupWebGL

// read models in, load them into webgl buffers
function loadModels() {

    var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
    var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner

    function makeCube(x,y, r, g, b) {
        // WEBGL ARCHIVES
        var cubeVertices = [
            // Front face (0-3)
            x+0,  y+0,  .1,
            x+.1, y+0,  .1,
            x+.1, y+.1,  .1,
            x+0,  y+.1,  .1,
            // Back face (4-7)
            x+0,  y+0, 0,
            x+0,  y+.1, 0,
            x+.1, y+.1, 0,
            x+.1, y+0, 0,
            // Top face (8-11)
            x+0,  y+.1, 0,
            x+0,  y+.1,  .1,
            x+.1, y+.1,  .1,
            x+.1, y+.1, 0,
            // Bottom face (12-15)
            x+0,  y+0, 0,
            x+.1, y+0, 0,
            x+.1, y+0,  .1,
            x+0,  y+0,  .1,
            // Right face (16-19)
            x+.1, y+0, 0,
            x+.1, y+.1, 0,
            x+.1, y+.1,  .1,
            x+.1, y+0,  .1,
            // Left face (20-23)
            x+0,  y+0, 0,
            x+0,  y+0,  .1,
            x+0,  y+.1,  .1,
            x+0,  y+.1, 0
        ];
        var cubeNormals = [
            // Front face
            0.0,  0.0,  1.0,
            0.0,  0.0,  1.0,
            0.0,  0.0,  1.0,
            0.0,  0.0,  1.0,
            // Back face
            0.0,  0.0, -1.0,
            0.0,  0.0, -1.0,
            0.0,  0.0, -1.0,
            0.0,  0.0, -1.0,
            // Top face
            0.0,  1.0,  0.0,
            0.0,  1.0,  0.0,
            0.0,  1.0,  0.0,
            0.0,  1.0,  0.0,
            // Bottom face
            0.0, -1.0,  0.0,
            0.0, -1.0,  0.0,
            0.0, -1.0,  0.0,
            0.0, -1.0,  0.0,
            // Right face
            1.0,  0.0,  0.0,
            1.0,  0.0,  0.0,
            1.0,  0.0,  0.0,
            1.0,  0.0,  0.0,
            // Left face
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0,
            -1.0,  0.0,  0.0
        ];
        var cubeTriangles = [
            0, 1, 2,      0, 2, 3,    // Front face
            4, 5, 6,      4, 6, 7,    // Back face
            8, 9, 10,     8, 10, 11,  // Top face
            12, 13, 14,   12, 14, 15, // Bottom face
            16, 17, 18,   16, 18, 19, // Right face
            20, 21, 22,   20, 22, 23  // Left face
        ]; // triangles to return

        var translation = vec3.fromValues(0,0,0); // begin without translation
        var xAxis = vec3.fromValues(1,0,0); // cube X axis
        var yAxis = vec3.fromValues(0,1,0); // cube Y axis
        var n = 5; // specular reflectivity
        var ambient = [0.1,0.1,0.1];
        var diffuse = [r,g,b];
        var specular = [0.3,0.3,0.3];

        var center = vec3.fromValues(0,0,0);
        var numVerts = cubeVertices.length;
        var vtxToAdd;
        for (whichSetVert=0; whichSetVert<numVerts; whichSetVert += 3) { // verts in set
            vtxToAdd = [cubeVertices[whichSetVert], cubeVertices[whichSetVert+1], cubeVertices[whichSetVert+2]]; // get vertex to add
            vec3.add(center,center,vtxToAdd); // add to ctr sum
        } // end for vertices in set
        vec3.scale(center,center,1/(numVerts/3)); // avg ctr sum

        vertexBuffers.push(gl.createBuffer()); // init empty webgl cube vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // active that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cubeVertices),gl.STATIC_DRAW); // data in
        normalBuffers.push(gl.createBuffer()); // init empty webgl cube normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cubeNormals),gl.STATIC_DRAW); // data in

        triSetSizes.push(cubeTriangles.length);

        // send the triangle indices to webGL
        triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(cubeTriangles),gl.STATIC_DRAW); // data in

        return({vertices:cubeVertices, normals:cubeNormals, triangles:cubeTriangles, translation:translation, xAxis:xAxis, yAxis:yAxis, n:n,
                ambient:ambient, diffuse:diffuse, specular:specular, center:center});
    }

    function makeField(width, height) {
        var fieldVertices = [0,0,0.1,    width,0,0.1,    0,height,0.1,   width,height,0.1];
        var fieldNormals = [0,0,-1,    0,0,-1,       0,0,-1,       0,0,-1];
        var fieldTriangles = [0,1,2,     1,2,3];
        var fieldCenter = vec3.fromValues(width/2,height/2,0);
        return({vertices:fieldVertices, normals:fieldNormals, triangles:fieldTriangles});
    }

    function makeGrid(width, height) {
        var gridVertices = [];
        // add horizontal lines
        for (var y=0; y<=height; y+=height/yLimit) {
            y = Math.round(y*1000000)/1000000;
            gridVertices.push(0,y,.09);
            gridVertices.push(width,y,.09);
            gridVertices.push(width,y,.25)
        }
        // add vertical lines
        for (var x=0; x<=width; x+=width/xLimit) {
            x = Math.round(x*10000)/10000;
            gridVertices.push(x,0,.09);
            gridVertices.push(x,height,.09);
            gridVertices.push(x,height,.25)
        }
        var gridNormals = [];
        for (var i=0; i<gridVertices.length; i++) {
            gridNormals.push(0,0,-1);   // every normal is same
        }
        var gridTriangles = [];
        for (var i=0; i<gridVertices.length/3; i+=3) {
            gridTriangles.push(i, i+1);
        }
        var gridCenter = vec3.fromValues(width/2,height/2,0);
        return({vertices:gridVertices, normals:gridNormals, triangles:gridTriangles});
    }

    function makeO() {
        var cubes = [];
        cubes.push(makeCube(startX,startY, 1, 1, 0)); // upper left
        cubes[0].x = 5;
        cubes[0].y = yLimit-1;
        cubes.push(makeCube(startX-.125,startY, 1, 1, 0));   // upper right
        cubes[1].x = 4;
        cubes[1].y = yLimit-1;
        cubes.push(makeCube(startX,startY-.125, 1, 1, 0));    // lower left
        cubes[2].x = 5;
        cubes[2].y = yLimit-2;
        cubes.push(makeCube(startX-.125,startY-.125, 1, 1, 0));    // lower right
        cubes[3].x = 4;
        cubes[3].y = yLimit-2;
        cubeArray.push(cubes);
        numTet++;
        var centerPt = vec3.create();
        for (var i=0; i<cubes.length; i++) {
            vec3.add(centerPt, centerPt, cubes[i].center);
        }
        vec3.scale(centerPt, centerPt, 1/cubes.length);
        for (var i=0; i<cubes.length; i++) {
            cubes[i].tetCenter = centerPt;
            cubes[i].rotation = 0;
        }
        var rotate = function() {
            // do nothing
            for (var i=0; i<cubes.length; i++) {
                cubes[i].rotation += 90;
                cubes[i].rotation = cubes[i].rotation % 360;
            }
        }
        return ({cubes:cubes, center:centerPt, rotate:rotate});
    }
    makeFunctions.push(makeO);

    function makeI() {
        var cubes = [];
        for (var i=0; i<4; i++) {
            cubes.push(makeCube(startX+0,startY-.125*i, 0, 1, 1));  // start at top
            cubes[i].x = 5;
            cubes[i].y = yLimit-1-i;
        }
        cubeArray.push(cubes);
        numTet++;
        // average center points
        var centerPt = vec3.create();
        for (var i=0; i<cubes.length; i++) {
            vec3.add(centerPt, centerPt, cubes[i].center);
        }
        vec3.scale(centerPt, centerPt, 1/cubes.length);
        for (var i=0; i<cubes.length; i++) {
            cubes[i].tetCenter = centerPt;
            cubes[i].rotation = 0;
        }
        centerPt[1] += .5;  // move over to corner
        var rotate = function() {
            var rot = cubes[0].rotation;
            // check if possible
            switch (rot) {
                // normal
                case 0:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 2;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x - 1;
                    futY = cur.y - 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x + 0;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 1;
                    futY = cur.y + 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 2;
                        cubes[0].y -= 1;
                        cubes[1].x -= 1;
                        cubes[1].y -= 0;
                        cubes[2].x += 0;
                        cubes[2].y += 1;
                        cubes[3].x += 1;
                        cubes[3].y += 2;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 90 degree
                case 90:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y - 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x - 0;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x - 1;
                    futY = cur.y + 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 2;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y -= 2;
                        cubes[1].x -= 0;
                        cubes[1].y -= 1;
                        cubes[2].x -= 1;
                        cubes[2].y += 0;
                        cubes[3].x -= 2;
                        cubes[3].y += 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 180 degree
                case 180:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 2;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x + 1;
                    futY = cur.y - 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x - 0;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 1;
                    futY = cur.y - 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 2;
                        cubes[0].y += 1;
                        cubes[1].x += 1;
                        cubes[1].y -= 0;
                        cubes[2].x -= 0;
                        cubes[2].y -= 1;
                        cubes[3].x -= 1;
                        cubes[3].y -= 2;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 360 degree
                case 270:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y + 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x - 0;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x + 1;
                    futY = cur.y + 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 2;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y += 2;
                        cubes[1].x -= 0;
                        cubes[1].y += 1;
                        cubes[2].x += 1;
                        cubes[2].y -= 0;
                        cubes[3].x += 2;
                        cubes[3].y -= 1
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
            }
        }
        return ({cubes:cubes, center:centerPt, rotate:rotate});
    }
    makeFunctions.push(makeI);

    function makeL() {
        var cubes = [];
        for (var i=0; i<3; i++) {
            cubes.push(makeCube(startX+0,startY-.125*i, 1, 0.5, 0));    // start at top
            cubes[i].x = 5;
            cubes[i].y = yLimit-1-i;
        }
        // average center points (center is center of middle cube)
        var centerPt = vec3.create();
        for (var i=0; i<cubes.length; i++) {
            vec3.add(centerPt, centerPt, cubes[i].center);
        }
        vec3.scale(centerPt, centerPt, 1/cubes.length);
        cubes.push(makeCube(startX-.125,startY-.25, 1, 0.5, 0));
        cubes[3].x = 4;
        cubes[3].y = yLimit-3;
        cubeArray.push(cubes);
        for (var i=0; i<cubes.length; i++) {
            cubes[i].tetCenter = centerPt;
            cubes[i].rotation = 0;
        }
        numTet++;
        var rotate = function() {
            var rot = cubes[0].rotation;
            // check if possible
            switch (rot) {
                // normal
                case 0:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1 does not move
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x + 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 2;
                    futY = cur.y + 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y -= 1;
                        cubes[2].x += 1;
                        cubes[2].y += 1;
                        cubes[3].x += 2;
                        cubes[3].y += 0;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 90 degree
                case 90:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1 does not move
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x - 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 0;
                    futY = cur.y + 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y -= 1;
                        cubes[2].x -= 1;
                        cubes[2].y += 1;
                        cubes[3].x -= 0;
                        cubes[3].y += 2;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 180 degree
                case 180:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1 does not move
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x - 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 2;
                    futY = cur.y - 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y += 1;
                        cubes[2].x -= 1;
                        cubes[2].y -= 1;
                        cubes[3].x -= 2;
                        cubes[3].y -= 0;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 360 degree
                case 270:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1 does not move
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x + 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 0;
                    futY = cur.y - 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y += 1;
                        cubes[2].x += 1;
                        cubes[2].y -= 1;
                        cubes[3].x += 0;
                        cubes[3].y -= 0;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
            }
        }
        return ({cubes:cubes, center:centerPt, rotate:rotate});
    }
    makeFunctions.push(makeL);

    function makeJ() {
        var cubes = [];
        for (var i=0; i<3; i++) {
            cubes.push(makeCube(startX+0,startY-.125*i, 0, 0, 1));
            cubes[i].x = 5;
            cubes[i].y = yLimit-1-i;
        }
        // average center points (center is center of middle cube)
        var centerPt = vec3.create();
        for (var i=0; i<cubes.length; i++) {
            vec3.add(centerPt, centerPt, cubes[i].center);
        }
        vec3.scale(centerPt, centerPt, 1/cubes.length);
        cubes.push(makeCube(startX+.125,startY-.25, 0, 0, 1));
        cubes[3].x = 6;
        cubes[3].y = yLimit-3;
        cubeArray.push(cubes);
        for (var i=0; i<cubes.length; i++) {
            cubes[i].tetCenter = centerPt;
            cubes[i].rotation = 0;
        }
        numTet++;
        var rotate = function() {
            var rot = cubes[0].rotation;
            // check if possible
            switch (rot) {
                // normal
                case 0:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1 does not move
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x + 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 0;
                    futY = cur.y + 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y -= 1;
                        cubes[2].x += 1;
                        cubes[2].y += 1;
                        cubes[3].x += 0;
                        cubes[3].y += 2;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 90 degree
                case 90:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1 does not move
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x - 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 2;
                    futY = cur.y + 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y -= 1;
                        cubes[2].x -= 1;
                        cubes[2].y += 1;
                        cubes[3].x -= 2;
                        cubes[3].y += 0;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 180 degree
                case 180:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1 does not move
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x - 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 0;
                    futY = cur.y - 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y += 1;
                        cubes[2].x -= 1;
                        cubes[2].y -= 1;
                        cubes[3].x -= 0;
                        cubes[3].y -= 2;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 360 degree
                case 270:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1 does not move
                    // cube 2
                    cur = cubes[2];
                    futX = cur.x + 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 2;
                    futY = cur.y - 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y += 1;
                        cubes[2].x += 1;
                        cubes[2].y -= 1;
                        cubes[3].x += 2;
                        cubes[3].y -= 0;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
            }
        }
        return ({cubes:cubes, center:centerPt, rotate:rotate});
    }
    makeFunctions.push(makeJ);

    function makeZ() {
        var cubes = [];
        cubes.push(makeCube(startX+0,startY+0, 1, 0, 0));   // top mid
        cubes[0].x = 5;
        cubes[0].y = yLimit-1;
        cubes.push(makeCube(startX+.125,startY+0, 1, 0, 0));    // top left
        cubes[1].x = 6;
        cubes[1].y = yLimit-1;
        cubes.push(makeCube(startX+0,startY-.125, 1, 0, 0));    // bottom mid
        cubes[2].x = 5;
        cubes[2].y = yLimit-2;
        var centerPt = cubes[2].center; // center is center of bottom mid
        cubes.push(makeCube(startX-.125,startY-.125, 1, 0, 0)); // bottom right
        cubes[3].x = 4;
        cubes[3].y = yLimit-2;
        cubeArray.push(cubes);
        for (var i=0; i<cubes.length; i++) {
            cubes[i].tetCenter = centerPt;
            cubes[i].rotation = 0;
        }
        numTet++;
        var rotate = function() {
            var rot = cubes[0].rotation;
            // check if possible
            switch (rot) {
                // normal
                case 0:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x - 2;
                    futY = cur.y + 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2 does not move
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y -= 1;
                        cubes[1].x -= 2;
                        cubes[1].y += 0;
                        cubes[3].x += 1;
                        cubes[3].y -= 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 90 degree
                case 90:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x + 0;
                    futY = cur.y - 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2 does not move
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y -= 1;
                        cubes[1].x += 0;
                        cubes[1].y -= 2;
                        cubes[3].x += 1;
                        cubes[3].y += 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 180 degree
                case 180:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x + 2;
                    futY = cur.y + 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2 does not move
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y += 1;
                        cubes[1].x += 2;
                        cubes[1].y += 0;
                        cubes[3].x -= 1;
                        cubes[3].y += 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 360 degree
                case 270:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x + 0;
                    futY = cur.y + 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2 does not move
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y += 1;
                        cubes[1].x += 0;
                        cubes[1].y += 2;
                        cubes[3].x -= 1;
                        cubes[3].y -= 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
            }
        }
        return ({cubes:cubes, center:centerPt, rotate:rotate});
    }
    makeFunctions.push(makeS);

    function makeS() {
        var cubes = [];
        cubes.push(makeCube(startX+0,startY+0, 0, 1, 0));   // top mid
        cubes[0].x = 5;
        cubes[0].y = yLimit-1;
        cubes.push(makeCube(startX-.125,startY+0, 0, 1, 0));    // top right
        cubes[1].x = 4;
        cubes[1].y = yLimit-1;
        cubes.push(makeCube(startX+0,startY-.125, 0, 1, 0));    // bottom mid
        cubes[2].x = 5;
        cubes[2].y = yLimit-2;
        var centerPt = cubes[2].center; // center is center of bottom mid
        cubes.push(makeCube(startX+.125,startY-.125, 0, 1, 0)); // bottom left
        cubes[3].x = 6;
        cubes[3].y = yLimit-2;
        cubeArray.push(cubes);
        for (var i=0; i<cubes.length; i++) {
            cubes[i].tetCenter = centerPt;
            cubes[i].rotation = 0;
        }
        numTet++;
        var rotate = function() {
            var rot = cubes[0].rotation;
            // check if possible
            switch (rot) {
                // normal
                case 0:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x - 0;
                    futY = cur.y - 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2 does not move
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y -= 1;
                        cubes[1].x -= 0;
                        cubes[1].y -= 2;
                        cubes[3].x -= 1;
                        cubes[3].y += 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 90 degree
                case 90:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x + 2;
                    futY = cur.y - 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2 does not move
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y -= 1;
                        cubes[1].x += 2;
                        cubes[1].y -= 0;
                        cubes[3].x -= 1;
                        cubes[3].y -= 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 180 degree
                case 180:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x + 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x + 0;
                    futY = cur.y + 2;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2 does not move
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x += 1;
                        cubes[0].y += 1;
                        cubes[1].x += 0;
                        cubes[1].y += 2;
                        cubes[3].x += 1;
                        cubes[3].y -= 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 360 degree
                case 270:
                    var able = true;
                    // cube 0
                    var cur = cubes[0];
                    var futX = cur.x - 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x - 2;
                    futY = cur.y + 0;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2 does not move
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[0].x -= 1;
                        cubes[0].y += 1;
                        cubes[1].x -= 2;
                        cubes[1].y += 0;
                        cubes[3].x += 1;
                        cubes[3].y += 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
            }
        }
        return ({cubes:cubes, center:centerPt, rotate:rotate});
    }
    makeFunctions.push(makeZ);

    function makeT() {
        var cubes = [];
        cubes.push(makeCube(startX+0,startY-.125, 1, 0, 1));    // bottom mid
        cubes[0].x = 5;
        cubes[0].y = yLimit-2;
        var centerPt = cubes[0].center; // center is center of bottom mid
        cubes.push(makeCube(startX+.125,startY-.125, 1, 0, 1)); // bottom left
        cubes[1].x = 6;
        cubes[1].y = yLimit-2;
        cubes.push(makeCube(startX-.125,startY-.125, 1, 0, 1)); // bottom right
        cubes[2].x = 4;
        cubes[2].y = yLimit-2;
        cubes.push(makeCube(startX+0,startY+0, 1, 0, 1));   // top mid
        cubes[3].x = 5;
        cubes[3].y = yLimit-1;
        cubeArray.push(cubes);
        for (var i=0; i<cubes.length; i++) {
            cubes[i].tetCenter = centerPt;
            cubes[i].rotation = 0;
        }
        numTet++;
        var rotate = function() {
            var rot = cubes[0].rotation;
            // check if possible
            switch (rot) {
                // normal
                case 0:
                    var able = true;
                    // cube 0 does not move
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x - 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2
                    var cur = cubes[2];
                    var futX = cur.x + 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[1].x -= 1;
                        cubes[1].y += 1;
                        cubes[2].x += 1;
                        cubes[2].y -= 1;
                        cubes[3].x -= 1;
                        cubes[3].y -= 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 90 degree
                case 90:
                    var able = true;
                    // cube 0 does not move
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x - 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2
                    var cur = cubes[2];
                    var futX = cur.x + 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[1].x -= 1;
                        cubes[1].y -= 1;
                        cubes[2].x += 1;
                        cubes[2].y += 1;
                        cubes[3].x += 1;
                        cubes[3].y -= 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 180 degree
                case 180:
                    var able = true;
                    // cube 0 does not move
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x + 1;
                    futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2
                    var cur = cubes[2];
                    var futX = cur.x - 1;
                    var futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x + 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[1].x += 1;
                        cubes[1].y -= 1;
                        cubes[2].x -= 1;
                        cubes[2].y += 1;
                        cubes[3].x += 1;
                        cubes[3].y += 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
                // 360 degree
                case 270:
                    var able = true;
                    // cube 0 does not move
                    // cube 1
                    cur = cubes[1];
                    futX = cur.x + 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 2
                    var cur = cubes[2];
                    var futX = cur.x - 1;
                    var futY = cur.y - 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }
                    // cube 3
                    cur = cubes[3];
                    futX = cur.x - 1;
                    futY = cur.y + 1;
                    if (able) { able = (futX < xLimit && futY < yLimit && !gridArray[futX][futY]); }

                    // if able, change rotation and coords
                    if (able) {
                        cubes[1].x += 1;
                        cubes[1].y += 1;
                        cubes[2].x -= 1;
                        cubes[2].y -= 1;
                        cubes[3].x -= 1;
                        cubes[3].y += 1;
                        for (var i=0; i<cubes.length; i++) {
                            cubes[i].rotation += 90;
                            cubes[i].rotation = cubes[i].rotation % 360;
                        }
                    }
                    break;
            }
        }
        return ({cubes:cubes, center:centerPt, rotate:rotate});
    }
    makeFunctions.push(makeT);

    try {
        // Init field
        field = makeField(fWidth + gridOffset*(xLimit-1), fHeight + gridOffset*(yLimit-1));
        field.on = false; // Moving or not
        field.translation = vec3.fromValues(0,0,0); // begin without translation
        field.xAxis = vec3.fromValues(1,0,0); // field X axis
        field.yAxis = vec3.fromValues(0,1,0); // field Y axis
        field.n = 5; // specular reflectivity
        field.ambient = [0.1,0.1,0.1];
        field.diffuse = [0.25,0.25,0.25];
        field.specular = [0,0,0];

        field.center = vec3.fromValues(0,0,0);
        var numVerts = field.vertices.length;
        var vtxToAdd;
        for (whichSetVert=0; whichSetVert<numVerts; whichSetVert += 3) { // verts in set
            vtxToAdd = [field.vertices[whichSetVert], field.vertices[whichSetVert+1], field.vertices[whichSetVert+2]]; // get vertex to add
            vec3.add(field.center,field.center,vtxToAdd); // add to ctr sum
            vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
            vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
        } // end for vertices in set
        vec3.scale(field.center,field.center,1/numVerts); // avg ctr sum

        vertexBuffers.push(gl.createBuffer()); // init empty webgl field vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // active that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(field.vertices),gl.STATIC_DRAW); // data in
        normalBuffers.push(gl.createBuffer()); // init empty webgl field normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(field.normals),gl.STATIC_DRAW); // data in

        triSetSizes.push(field.triangles.length);

        // send the triangle indices to webGL
        triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(field.triangles),gl.STATIC_DRAW); // data in

        // Init grid
        grid = makeGrid(fWidth + gridOffset*(xLimit-1), fHeight + gridOffset*(yLimit-1));
        grid.on = false; // Moving or not
        grid.translation = vec3.fromValues(0,0,0); // begin without translation
        grid.xAxis = vec3.fromValues(1,0,0); // grid X axis
        grid.yAxis = vec3.fromValues(0,1,0); // grid Y axis
        grid.n = 5; // specular reflectivity
        grid.ambient = [0.1,0.1,0.1];
        grid.diffuse = [.6,0.6,.6];
        grid.specular = [0.3,0.3,0.3];

        grid.center = vec3.fromValues(0,0,0);
        var numVerts = grid.vertices.length;
        var vtxToAdd;
        for (whichSetVert=0; whichSetVert<numVerts; whichSetVert += 3) { // verts in set
            vtxToAdd = [grid.vertices[whichSetVert], grid.vertices[whichSetVert+1], grid.vertices[whichSetVert+2]]; // get vertex to add
            vec3.add(grid.center,grid.center,vtxToAdd); // add to ctr sum
        } // end for vertices in set
        vec3.scale(grid.center,grid.center,1/numVerts); // avg ctr sum

        vertexBuffers.push(gl.createBuffer()); // init empty webgl grid vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // active that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(grid.vertices),gl.STATIC_DRAW); // data in
        normalBuffers.push(gl.createBuffer()); // init empty webgl grid normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(grid.normals),gl.STATIC_DRAW); // data in

        triSetSizes.push(grid.triangles.length);

        // send the triangle indices to webGL
        triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(grid.triangles),gl.STATIC_DRAW); // data in

        viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global
    } // end try
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {
    var i = Math.floor(Math.random() * 7) % 7;
    live = makeFunctions[2]();

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal

        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix

        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader

        void main(void) {

            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z));
        }
    `;

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world

        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position

        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent

        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment

        void main(void) {

            // ambient term
            vec3 ambient = uAmbient*uLightAmbient;

            // diffuse term
            vec3 normal = normalize(vVertexNormal);
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term

            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term

            // combine to output color
            vec3 colorOut = ambient + diffuse + specular; // no specular yet
            gl_FragColor = vec4(colorOut, 1.0);
        }
    `;

    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array

                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat

                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess

                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try

    catch(e) {
        console.log(e);
    } // end catch
    setTimeout(function alterPosition() {
        var movable = true; // assume movable
        for (var i=0; i<live.cubes.length; i++) {
            if (movable) {
                var cur = live.cubes[i];
                var x = cur.x;
                var y = cur.y;
                if (y <= 0)
                    movable = false;
                else
                    movable = !gridArray[y-1][x];  // check grid in direction asked
            }
        }
        if (movable)    // if still movable, move all cubes
            for (var i=0; i<live.cubes.length; i++) {
                var cur = live.cubes[i];
                vec3.add(cur.translation,cur.translation,vec3.scale(temp,vec3.fromValues(0,1,0),-.1-gridOffset));
                cur.y--;
            }
        else {  // not movable -> set positions to true and make new tetromino
            for (var i=0; i<live.cubes.length; i++) {
                var x = live.cubes[i].x;
                var y = live.cubes[i].y;
                gridArray[y][x] = true;
            }
            if (!gameOver) {
                printGrid();
                var i = Math.floor(Math.random()*7) % 7;
                live = makeFunctions[i]();
            }
        }
        setTimeout(alterPosition, 1000);
    }, 1000); // switch flag value every 2 seconds
} // end setup shaders

// render the loaded model
function renderModels() {

    // check to see if cubes need removed from Tetris
    function checkRows() {
        for (var i=0; i<gridArray.length; i++) {
            // check if row filled
            var lineNum = 0;
            for (var j=0; j<gridArray[i].length; j++) {
                if (gridArray[i][j])
                    lineNum++;
                // if row is filled, remove cubes
                if (lineNum == xLimit) {
                    // remove cubes in line
                    for (var c=0; c<cubeArray.length; c++) {
                        for (var ci=0; ci<cubeArray[c].length; ci++) {
                            var curCube = cubeArray[c][ci];
                            if (curCube.y == i) {
                                console.log("Removed-> X: " + curCube.x + " Y: " + curCube.y);
                                //cubeArray[c].splice(ci, 1);
                                curCube.diffuse = [1,1,1]; // make remove row white (debug)
                                //ci--;
                            }
                            else if (curCube.y > i) {
                                // if above line removed, move them down
                                vec3.add(curCube.translation,curCube.translation,vec3.scale(temp,vec3.fromValues(0,1,0),-.1-gridOffset));
                                curCube.y--;
                            }
                        }
                    }
                    // move grid rows down
                    for (var ii=i; ii<gridArray.length; ii++) {
                        // if top row, set all to false
                        if (ii == gridArray.length-1) {
                            for (var jj=0; jj<gridArray[ii].length; jj++) {
                                gridArray[ii][jj] = false;
                            }
                        }
                        else
                            gridArray[ii] = gridArray[ii+1];
                    }
                    printGrid();
                }
            }
        }

        // check top row for gameOver
        var done = false;
        for (var x=0; x<xLimit; x++) {
            if (gridArray[yLimit-1][x]) {
                done = true;
                break;
            }
        }
        if (done) { gameOver = true; }
    }

    // construct the model transform matrix, based on model state FOR FIELD AND GRID
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center));

        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0, 0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)

        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)

    } // end make model transform

    // construct the model transform matrix, based on model state FOR CUBES
    function makeModelTransformCUBE(currModel, rotation) {
        var sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the tetromino to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.tetCenter));



        // rotate the model by the current rotation orientation
        mat4.set(sumRotation, // get the composite rotation
            Math.cos(degToRad(rotation)), Math.sin(degToRad(rotation)), 0, 0,
            -Math.sin(degToRad(rotation)), Math.cos(degToRad(rotation)), 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)

        // translate back to tetromino center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.tetCenter),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)

    } // end make model transform

    checkRows();

    // check if gameOver has ben tripped
    if (gameOver)
        return;



    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices

    window.requestAnimationFrame(renderModels); // set up frame render callback

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view

    // render field
    makeModelTransform(field);
    pvmMatrix = mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // premultiply with pv matrix
    gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
    gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

    // reflectivity: feed to the fragment shader
    gl.uniform3fv(ambientULoc,field.ambient); // pass in the ambient reflectivity
    gl.uniform3fv(diffuseULoc,field.diffuse); // pass in the diffuse reflectivity
    gl.uniform3fv(specularULoc,field.specular); // pass in the specular reflectivity
    gl.uniform1f(shininessULoc,field.n); // pass in the specular exponent

    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[fIndex]); // activate vertex buffer
    gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[fIndex]); // activate normal buffer
    gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[fIndex]); // activate tri buffer

    // draw a transformed instance of the ellipsoid
    gl.drawElements(gl.TRIANGLES,triSetSizes[fIndex],gl.UNSIGNED_SHORT,0); // render

    // render grid
    makeModelTransform(grid);
    pvmMatrix = mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // premultiply with pv matrix
    gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
    gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

    // reflectivity: feed to the fragment shader
    gl.uniform3fv(ambientULoc,grid.ambient); // pass in the ambient reflectivity
    gl.uniform3fv(diffuseULoc,grid.diffuse); // pass in the diffuse reflectivity
    gl.uniform3fv(specularULoc,grid.specular); // pass in the specular reflectivity
    gl.uniform1f(shininessULoc,grid.n); // pass in the specular exponent

    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[gridIndex]); // activate vertex buffer
    gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[gridIndex]); // activate normal buffer
    gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[gridIndex]); // activate tri buffer

    // draw a transformed instance of the ellipsoid
    gl.lineWidth(gridOffset);
    gl.drawElements(gl.LINES,triSetSizes[gridIndex],gl.UNSIGNED_SHORT,0); // render

    // render cubes from shapes
    for (var i=0; i<cubeArray.length; i++) {
        for (var j=0; j<cubeArray[i].length; j++) {
            var cur = cubeArray[i][j];
            if (cur.diffuse[0] == 1 && cur.diffuse[1] == 1 && cur.diffuse[2] == 1) {
                //console.log("Skipped-> X: " + cur.x + " Y: " + cur.y);
            } else {
                makeModelTransformCUBE(cur, cur.rotation);
                pvmMatrix = mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // premultiply with pv matrix
                gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
                gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

                // reflectivity: feed to the fragment shader
                gl.uniform3fv(ambientULoc,cur.ambient); // pass in the ambient reflectivity
                gl.uniform3fv(diffuseULoc,cur.diffuse); // pass in the diffuse reflectivity
                gl.uniform3fv(specularULoc,cur.specular); // pass in the specular reflectivity
                gl.uniform1f(shininessULoc,cur.n); // pass in the specular exponent

                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[cubeStart+i*4+j]); // activate vertex buffer
                gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[cubeStart+i*4+j]); // activate normal buffer
                gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[cubeStart+i*4+j]); // activate tri buffer

                // draw a transformed instance of the ellipsoid
                gl.drawElements(gl.TRIANGLES,triSetSizes[cubeStart+i*4+j],gl.UNSIGNED_SHORT,0); // render
            }

        }
    }
} // end render model


/* MAIN -- HERE is where execution begins after window load */

function main() {

  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  setupShaders(); // setup the webGL shaders
  renderModels(); // draw the triangles using webGL

} // end main
