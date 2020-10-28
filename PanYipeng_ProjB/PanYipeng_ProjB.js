//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda
// became:
//
// BasicShapes.js  MODIFIED for EECS 351-1, 
//									Northwestern Univ. Jack Tumblin
//		--converted from 2D to 4D (x,y,z,w) vertices
//		--extend to other attributes: color, surface normal, etc.
//		--demonstrate how to keep & use MULTIPLE colored shapes in just one
//			Vertex Buffer Object(VBO). 
//		--create several canonical 3D shapes borrowed from 'GLUT' library:
//		--Demonstrate how to make a 'stepped spiral' tri-strip,  and use it
//			to build a cylinder, sphere, and torus.
//
// Vertex shader program----------------------------------
var VSHADER_SOURCE = 
  'uniform mat4 u_ModelMatrix;\n' +
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_ModelMatrix * a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program----------------------------------
var FSHADER_SOURCE = 
//  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
//  '#endif GL_ES\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

// Global Variables
var ANGLE_STEP = 45.0;		// Rotation angle rate (degrees/second)
var floatsPerVertex = 7;	// # of Float32Array elements used for each vertex
													// (x,y,z,w)position + (r,g,b)color
													// Later, see if you can add:
													// (x,y,z) surface normal + (tx,ty) texture addr.

//==============================================================================
  // Retrieve <canvas> element
var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
var gl = getWebGLContext(canvas);

var shapeBufferHandle = gl.createBuffer();  

var flag = 0;
var wingAngle = 0;
var wingAngleVert = 0;
var tempWingAngle = 0;
var bodyAngle = 0;

// Global vars for mouse click-and-drag for rotation.
var isDrag=false;		// mouse-drag: true when user holds down mouse button
var xMclik=0.0;			// last mouse button-down position (in CVV coords)
var yMclik=0.0;   
var xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot=0.0;  

var qNew = new Quaternion(0,0,0,1); // most-recent mouse drag's rotation
var qTot = new Quaternion(0,0,0,1);	// 'current' orientation (made from qNew)
var quatMatrix = new Matrix4();				// rotation matrix, made from latest qTot

var cameraYX = 0;
var cameraYY = 0;
var cameraX = 0;
var cameraAngleX = 0;
var cameraAngleY = 0;
var gs_last = 0;


window.addEventListener("keydown", myKeyDown, false);

function main() {
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // 
  var n = initVertexBuffer(gl);
  if (n < 0) {
    console.log('Failed to set the vertex information');
    return;
  }

  canvas.onmousedown	=	function(ev){myMouseDown( ev, gl, canvas) }; 
  					// when user's mouse button goes down, call mouseDown() function
  canvas.onmousemove = 	function(ev){myMouseMove( ev, gl, canvas) };
											// when the mouse moves, call mouseMove() function					
  canvas.onmouseup = 		function(ev){myMouseUp(   ev, gl, canvas)};
  					// NOTE! 'onclick' event is SAME as on 'mouseup' event
  					// in Chrome Brower on MS Windows 7, and possibly other 
  					// operating systems; thus I use 'mouseup' instead.

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

	// NEW!! Enable 3D depth-test when drawing: don't over-draw at any pixel 
	// unless the new Z value is closer to the eye than the old one..
//	gl.depthFunc(gl.LESS);			 // WebGL default setting: (default)
	gl.enable(gl.DEPTH_TEST); 	 
	 
//==============================================================================
// STEP 4:   REMOVE This "reversed-depth correction"
//       when you apply any of the 3D camera-lens transforms: 
//      (e.g. Matrix4 member functions 'perspective(), frustum(), ortho() ...)
//======================REVERSED-DEPTH Correction===============================

  //  b) reverse the usage of the depth-buffer's stored values, like this:
  //gl.enable(gl.DEPTH_TEST); // enabled by default, but let's be SURE.
  //gl.clearDepth(1.0);       // each time we 'clear' our depth buffer, set all
                            // pixel depths to 0.0  (1.0 is DEFAULT)
  //gl.depthFunc(gl.LESS); // draw a pixel only if its depth value is GREATER
                            // than the depth buffer's stored value.
                            // (gl.LESS is DEFAULT; reverse it!)
//=====================================================================

  // Get handle to graphics system's storage location of u_ModelMatrix
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) { 
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }
  // Create a local version of our model matrix in JavaScript 
  var modelMatrix = new Matrix4();
  
  // Create, init current rotation angle value in JavaScript
  var currentAngle = 0.0;

//-----------------  
  // Start drawing: create 'tick' variable whose value is this function:
  var tick = function() {
	gs_last = Date.now();
    //currentAngle = animate(currentAngle);  // Update the rotation angle
	if(flag == 1 && wingAngle < 180) wingAngle = animate(wingAngle);
	else if(flag == 1 && !(wingAngle<180)) {
		wingAngle = 180;
		flag = 2;
	}
	if(flag == 2 || (flag == 3 && wingAngleVert > 2 && wingAngleVert<28)){
		tempWingAngle = animate(tempWingAngle);
		wingAngleVert = tempWingAngle % 30 *12;
		if(tempWingAngle < 90 && bodyAngle < tempWingAngle) {
			bodyAngle = tempWingAngle;
		}
	}
	else if(flag == 3 && (wingAngleVert <2 || wingAngleVert>28)){
		tempWingAngle = 0;
		wingAngleVert = 0;
		bodyAngle = -animate(-bodyAngle);
		if(bodyAngle < 2){
			bodyAngle = 0;
			flag = 4;
		}
	}
	if(flag == 4 && wingAngle > 2) {
		wingAngle = -animate(-wingAngle);
	}
	else if(flag == 4 && !(wingAngle > 2)){
		wingAngle = 0;
		flag = 0;
	}
	drawResize();   
	drawAll(gl, n, currentAngle, modelMatrix, u_ModelMatrix);   // Draw shapes
    // report current angle on console
    //console.log('currentAngle=',currentAngle);
    requestAnimationFrame(tick, canvas);   
    									// Request that the browser re-draw the webpage
  };
  tick();							// start (and continue) animation: draw current image
}

function initVertexBuffer(gl) {
//==============================================================================
// Create one giant vertex buffer object (VBO) that holds all vertices for all
// shapes.
 
 	// Make each 3D shape in its own array of vertices:
  makeCylinder();					// create, fill the cylVerts array
  makeCylinder2();					// create, fill the cylVerts array
  makeSphere();						// create, fill the sphVerts array
  makeTorus();						// create, fill the torVerts array
  makeGroundGrid();				// create, fill the gndVerts array
  makeWings();
  makeCone();
  makeBallon();
  makeBasket();
  makePyramid();
  makeAxis();
  // how many floats total needed to store all shapes?
	var mySiz = (2*cylVerts.length + 2*sphVerts.length + 
							 torVerts.length + gndVerts.length + wingVerts.length + coneVerts.length + ballonVerts.length + basketVerts.length + pyramidVerts.length + AxisVerts.length);						

	// How many vertices total?
	var nn = mySiz / floatsPerVertex;
	console.log('nn is', nn, 'mySiz is', mySiz, 'floatsPerVertex is', floatsPerVertex);
	// Copy all shapes into one big Float32 array:
  var colorShapes = new Float32Array(mySiz);
	// Copy them:  remember where to start for each shape:
		sphStart = 0;		
	for(i=0,j=0; j< sphVerts.length; i++, j++) {// don't initialize i -- reuse it!
		colorShapes[i] = sphVerts[j];
	}
		cylStart = i;							
  		for(j=0; j< cylVerts.length; i++,j++) {
  		colorShapes[i] = cylVerts[j];
		}				
		torStart = i;						// next, we'll store the torus;
	for(j=0; j< torVerts.length; i++, j++) {
		colorShapes[i] = torVerts[j];
		}
		gndStart = i;						// next we'll store the ground-plane;
	for(j=0; j< gndVerts.length; i++, j++) {
		colorShapes[i] = gndVerts[j];
	}
	    wingStart = i;
	for(j=0; j< wingVerts.length; i++, j++) {
		colorShapes[i] = wingVerts[j];
	}
		whiteSphereStart = i;
	for(j=0; j< sphVerts.length; i++, j++) {
		colorShapes[i] = sphVerts[j];
	}
		cyl2Start = i;
	for(j=0; j< cylVerts.length; i++, j++) {
		colorShapes[i] = cylVerts2[j];
	}
		coneStart = i;	
	for(j=0; j< coneVerts.length; i++, j++) {
		colorShapes[i] = coneVerts[j];
	}
		ballonStart = i;	
	for(j=0; j< ballonVerts.length; i++, j++) {
		colorShapes[i] = ballonVerts[j];
	}
		basketStart = i;	
	for(j=0; j< basketVerts.length; i++, j++) {
		colorShapes[i] = basketVerts[j];
	}
		pyramidStart = i;	
	for(j=0; j< pyramidVerts.length; i++, j++) {
		colorShapes[i] = pyramidVerts[j];
	}
		axisStart = i;	
	for(j=0; j< AxisVerts.length; i++, j++) {
		colorShapes[i] = AxisVerts[j];
	}
  // Create a buffer object on the graphics hardware:
  if (!shapeBufferHandle) {
    console.log('Failed to create the shape buffer object');
    return false;
  }

  // Bind the the buffer object to target:
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
  // Transfer data from Javascript array colorShapes to Graphics system VBO
  // (Use sparingly--may be slow if you transfer large shapes stored in files)
  gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);
    
  //Get graphics system's handle for our Vertex Shader's position-input variable: 
  var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return -1;
  }
  var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?

  // Use handle to specify how to retrieve **POSITION** data from our VBO:
  gl.vertexAttribPointer(
  		a_Position, 	// choose Vertex Shader attribute to fill with data
  		4, 						// how many values? 1,2,3 or 4.  (we're using x,y,z,w)
  		gl.FLOAT, 		// data type for each value: usually gl.FLOAT
  		false, 				// did we supply fixed-point data AND it needs normalizing?
  		FSIZE * floatsPerVertex, // Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  		0);						// Offset -- now many bytes from START of buffer to the
  									// value we will actually use?
  gl.enableVertexAttribArray(a_Position);  
  									// Enable assignment of vertex buffer object's position data

  // Get graphics system's handle for our Vertex Shader's color-input variable;
  var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
  if(a_Color < 0) {
    console.log('Failed to get the storage location of a_Color');
    return -1;
  }
  // Use handle to specify how to retrieve **COLOR** data from our VBO:
  gl.vertexAttribPointer(
  	a_Color, 				// choose Vertex Shader attribute to fill with data
  	3, 							// how many values? 1,2,3 or 4. (we're using R,G,B)
  	gl.FLOAT, 			// data type for each value: usually gl.FLOAT
  	false, 					// did we supply fixed-point data AND it needs normalizing?
  	FSIZE * 7, 			// Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  	FSIZE * 4);			// Offset -- how many bytes from START of buffer to the
  									// value we will actually use?  Need to skip over x,y,z,w
  									
  gl.enableVertexAttribArray(a_Color);  
  									// Enable assignment of vertex buffer object's position data

	//--------------------------------DONE!
  // Unbind the buffer object 
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return nn;
}

// simple & quick-- 
// I didn't use any arguments such as color choices, # of verts,slices,bars, etc.
// YOU can improve these functions to accept useful arguments...
//
function makeDiamond() {
//==============================================================================
// Make a diamond-like shape from two adjacent tetrahedra, aligned with Z axis.

	// YOU write this one...
	
}


function makeCylinder() {
//==============================================================================
// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
// 'stepped spiral' design described in notes.
// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
//
 var ctrColr = new Float32Array([0.1, 0.1, 0.1]);	// dark gray
 var topColr = new Float32Array([0.1, 0.1, 0.1]);	// light green
 var botColr = new Float32Array([0.1, 0.1, 0.1]);	// light blue
 var capVerts = 16;	// # of vertices around the topmost 'cap' of the shape
 var botRadius = 1;		// radius of bottom of cylinder (top always 1.0)
 
 // Create a (global) array to hold this cylinder's vertices;
 cylVerts = new Float32Array(  ((capVerts*6) -2) * floatsPerVertex);
										// # of vertices * # of elements needed to store them. 

	// Create circle-shaped top cap of cylinder at z=+1.0, radius 1.0
	// v counts vertices: j counts array elements (vertices * elements per vertex)
	for(v=1,j=0; v<2*capVerts; v++,j+=floatsPerVertex) {	
		// skip the first vertex--not needed.
		if(v%2==0)
		{				// put even# vertices at center of cylinder's top cap:
			cylVerts[j  ] = 0.0; 			// x,y,z,w == 0,0,1,1
			cylVerts[j+1] = 0.0;	
			cylVerts[j+2] = 1.0; 
			cylVerts[j+3] = 1.0;			// r,g,b = topColr[]
			cylVerts[j+4]=ctrColr[0]; 
			cylVerts[j+5]=ctrColr[1]; 
			cylVerts[j+6]=ctrColr[2];
		}
		else { 	// put odd# vertices around the top cap's outer edge;
						// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
						// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
			cylVerts[j  ] = Math.cos(Math.PI*(v-1)/capVerts);			// x
			cylVerts[j+1] = Math.sin(Math.PI*(v-1)/capVerts);			// y
			//	(Why not 2*PI? because 0 < =v < 2*capVerts, so we
			//	 can simplify cos(2*PI * (v-1)/(2*capVerts))
			cylVerts[j+2] = 1.0;	// z
			cylVerts[j+3] = 1.0;	// w.
			// r,g,b = topColr[]
			cylVerts[j+4]=topColr[0]; 
			cylVerts[j+5]=topColr[1]; 
			cylVerts[j+6]=topColr[2];			
		}
	}
	// Create the cylinder side walls, made of 2*capVerts vertices.
	// v counts vertices within the wall; j continues to count array elements
	for(v=0; v< 2*capVerts; v++, j+=floatsPerVertex) {
		if(v%2==0)	// position all even# vertices along top cap:
		{		
				cylVerts[j  ] = Math.cos(Math.PI*(v)/capVerts);		// x
				cylVerts[j+1] = Math.sin(Math.PI*(v)/capVerts);		// y
				cylVerts[j+2] = 1.0;	// z
				cylVerts[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts[j+4]=topColr[0]; 
				cylVerts[j+5]=topColr[1]; 
				cylVerts[j+6]=topColr[2];			
		}
		else		// position all odd# vertices along the bottom cap:
		{
				cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v-1)/capVerts);		// x
				cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v-1)/capVerts);		// y
				cylVerts[j+2] =-1.0;	// z
				cylVerts[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts[j+4]=botColr[0]; 
				cylVerts[j+5]=botColr[1]; 
				cylVerts[j+6]=botColr[2];			
		}
	}
	// Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
	// v counts the vertices in the cap; j continues to count array elements
	for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
		if(v%2==0) {	// position even #'d vertices around bot cap's outer edge
			cylVerts[j  ] = botRadius * Math.cos(Math.PI*(v)/capVerts);		// x
			cylVerts[j+1] = botRadius * Math.sin(Math.PI*(v)/capVerts);		// y
			cylVerts[j+2] =-1.0;	// z
			cylVerts[j+3] = 1.0;	// w.
			// r,g,b = topColr[]
			cylVerts[j+4]=botColr[0]; 
			cylVerts[j+5]=botColr[1]; 
			cylVerts[j+6]=botColr[2];		
		}
		else {				// position odd#'d vertices at center of the bottom cap:
			cylVerts[j  ] = 0.0; 			// x,y,z,w == 0,0,-1,1
			cylVerts[j+1] = 0.0;	
			cylVerts[j+2] =-1.0; 
			cylVerts[j+3] = 1.0;			// r,g,b = botColr[]
			cylVerts[j+4]=botColr[0]; 
			cylVerts[j+5]=botColr[1]; 
			cylVerts[j+6]=botColr[2];
		}
	}
}

function makeCylinder2() {
//==============================================================================
// Make a cylinder shape from one TRIANGLE_STRIP drawing primitive, using the
// 'stepped spiral' design described in notes.
// Cylinder center at origin, encircles z axis, radius 1, top/bottom at z= +/-1.
//
 var ctrColr = new Float32Array([0.1, 0.1, 0.1]);	// dark gray
 var topColr = new Float32Array([0.1, 0.1, 0.1]);	// light green
 var botColr = new Float32Array([0.1, 0.1, 0.1]);	// light blue
 var capVerts = 16;	// # of vertices around the topmost 'cap' of the shape
 var botRadius = 0.6;		// radius of bottom of cylinder (top always 1.0)
 
 // Create a (global) array to hold this cylinder's vertices;
 cylVerts2 = new Float32Array(  ((capVerts*6) -2) * floatsPerVertex);
										// # of vertices * # of elements needed to store them. 

	// Create circle-shaped top cap of cylinder at z=+1.0, radius 1.0
	// v counts vertices: j counts array elements (vertices * elements per vertex)
	for(v=1,j=0; v<2*capVerts; v++,j+=floatsPerVertex) {	
		// skip the first vertex--not needed.
		if(v%2==0)
		{				// put even# vertices at center of cylinder's top cap:
			cylVerts2[j  ] = 0.0; 			// x,y,z,w == 0,0,1,1
			cylVerts2[j+1] = 0.0;	
			cylVerts2[j+2] = 1.0; 
			cylVerts2[j+3] = 1.0;			// r,g,b = topColr[]
			cylVerts2[j+4]=ctrColr[0]; 
			cylVerts2[j+5]=ctrColr[1]; 
			cylVerts2[j+6]=ctrColr[2];
		}
		else { 	// put odd# vertices around the top cap's outer edge;
						// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
						// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
			cylVerts2[j  ] = Math.cos(Math.PI*(v-1)/capVerts);			// x
			cylVerts2[j+1] = Math.sin(Math.PI*(v-1)/capVerts);			// y
			//	(Why not 2*PI? because 0 < =v < 2*capVerts, so we
			//	 can simplify cos(2*PI * (v-1)/(2*capVerts))
			cylVerts2[j+2] = 1.0;	// z
			cylVerts2[j+3] = 1.0;	// w.
			// r,g,b = topColr[]
			cylVerts2[j+4]=topColr[0]; 
			cylVerts2[j+5]=topColr[1]; 
			cylVerts2[j+6]=topColr[2];			
		}
	}
	// Create the cylinder side walls, made of 2*capVerts vertices.
	// v counts vertices within the wall; j continues to count array elements
	for(v=0; v< 2*capVerts; v++, j+=floatsPerVertex) {
		if(v%2==0)	// position all even# vertices along top cap:
		{		
				cylVerts2[j  ] = Math.cos(Math.PI*(v)/capVerts);		// x
				cylVerts2[j+1] = Math.sin(Math.PI*(v)/capVerts);		// y
				cylVerts2[j+2] = 1.0;	// z
				cylVerts2[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts2[j+4]=topColr[0]; 
				cylVerts2[j+5]=topColr[1]; 
				cylVerts2[j+6]=topColr[2];			
		}
		else		// position all odd# vertices along the bottom cap:
		{
				cylVerts2[j  ] = botRadius * Math.cos(Math.PI*(v-1)/capVerts);		// x
				cylVerts2[j+1] = botRadius * Math.sin(Math.PI*(v-1)/capVerts);		// y
				cylVerts2[j+2] =-1.0;	// z
				cylVerts2[j+3] = 1.0;	// w.
				// r,g,b = topColr[]
				cylVerts2[j+4]=botColr[0]; 
				cylVerts2[j+5]=botColr[1]; 
				cylVerts2[j+6]=botColr[2];			
		}
	}
	// Create the cylinder bottom cap, made of 2*capVerts -1 vertices.
	// v counts the vertices in the cap; j continues to count array elements
	for(v=0; v < (2*capVerts -1); v++, j+= floatsPerVertex) {
		if(v%2==0) {	// position even #'d vertices around bot cap's outer edge
			cylVerts2[j  ] = botRadius * Math.cos(Math.PI*(v)/capVerts);		// x
			cylVerts2[j+1] = botRadius * Math.sin(Math.PI*(v)/capVerts);		// y
			cylVerts2[j+2] =-1.0;	// z
			cylVerts2[j+3] = 1.0;	// w.
			// r,g,b = topColr[]
			cylVerts2[j+4]=botColr[0]; 
			cylVerts2[j+5]=botColr[1]; 
			cylVerts2[j+6]=botColr[2];		
		}
		else {				// position odd#'d vertices at center of the bottom cap:
			cylVerts2[j  ] = 0.0; 			// x,y,z,w == 0,0,-1,1
			cylVerts2[j+1] = 0.0;	
			cylVerts2[j+2] =-1.0; 
			cylVerts2[j+3] = 1.0;			// r,g,b = botColr[]
			cylVerts2[j+4]=botColr[0]; 
			cylVerts2[j+5]=botColr[1]; 
			cylVerts2[j+6]=botColr[2];
		}
	}
}

function makeSphere() {
//==============================================================================
// Make a sphere from one OpenGL TRIANGLE_STRIP primitive.   Make ring-like 
// equal-lattitude 'slices' of the sphere (bounded by planes of constant z), 
// and connect them as a 'stepped spiral' design (see makeCylinder) to build the
// sphere from one triangle strip.
  var slices = 13;		// # of slices of the sphere along the z axis. >=3 req'd
											// (choose odd # or prime# to avoid accidental symmetry)
  var sliceVerts	= 27;	// # of vertices around the top edge of the slice
											// (same number of vertices on bottom of slice, too)
  var topColr = new Float32Array([1.0, 1.0, 0.1]);	// North Pole: light gray
  var equColr = new Float32Array([1.0, 0.5, 0.8]);	// Equator:    bright green
  var equ2Colr = new Float32Array([1.0, 0.3, 0.8]);	// Equator:    bright green
  var botColr = new Float32Array([0.2, 1.0, 0.8]);	// South Pole: brightest gray.
  var sliceAngle = Math.PI/slices;	// lattitude angle spanned by one slice.

	// Create a (global) array to hold this sphere's vertices:
  sphVerts = new Float32Array(  ((slices * 2* sliceVerts) -2) * floatsPerVertex);
										// # of vertices * # of elements needed to store them. 
										// each slice requires 2*sliceVerts vertices except 1st and
										// last ones, which require only 2*sliceVerts-1.
										
	// Create dome-shaped top slice of sphere at z=+1
	// s counts slices; v counts vertices; 
	// j counts array elements (vertices * elements per vertex)
	var cos0 = 0.0;					// sines,cosines of slice's top, bottom edge.
	var sin0 = 0.0;
	var cos1 = 0.0;
	var sin1 = 0.0;	
	var j = 0;							// initialize our array index
	var isLast = 0;
	var isFirst = 1;
	for(s=0; s<slices; s++) {	// for each slice of the sphere,
		// find sines & cosines for top and bottom of this slice
		if(s==0) {
			isFirst = 1;	// skip 1st vertex of 1st slice.
			cos0 = 1.0; 	// initialize: start at north pole.
			sin0 = 0.0;
		}
		else {					// otherwise, new top edge == old bottom edge
			isFirst = 0;	
			cos0 = cos1;
			sin0 = sin1;
		}								// & compute sine,cosine for new bottom edge.
		cos1 = Math.cos((s+1)*sliceAngle);
		sin1 = Math.sin((s+1)*sliceAngle);
		// go around the entire slice, generating TRIANGLE_STRIP verts
		// (Note we don't initialize j; grows with each new attrib,vertex, and slice)
		if(s==slices-1) isLast=1;	// skip last vertex of last slice.
		for(v=isFirst; v< 2*sliceVerts-isLast; v++, j+=floatsPerVertex) {	
			if(v%2==0)
			{				// put even# vertices at the the slice's top edge
							// (why PI and not 2*PI? because 0 <= v < 2*sliceVerts
							// and thus we can simplify cos(2*PI(v/2*sliceVerts))  
				sphVerts[j  ] = sin0 * Math.cos(Math.PI*(v)/sliceVerts); 	
				sphVerts[j+1] = sin0 * Math.sin(Math.PI*(v)/sliceVerts);	
				sphVerts[j+2] = cos0;		
				sphVerts[j+3] = 1.0;			
			}
			else { 	// put odd# vertices around the slice's lower edge;
							// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
							// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
				sphVerts[j  ] = sin1 * Math.cos(Math.PI*(v-1)/sliceVerts);		// x
				sphVerts[j+1] = sin1 * Math.sin(Math.PI*(v-1)/sliceVerts);		// y
				sphVerts[j+2] = cos1;																				// z
				sphVerts[j+3] = 1.0;																				// w.		
			}
			if(s==0) {	// finally, set some interesting colors for vertices:
				sphVerts[j+4]=topColr[0]; 
				sphVerts[j+5]=topColr[1]; 
				sphVerts[j+6]=topColr[2];	
				}
			else if(s==slices-1) {
				sphVerts[j+4]=botColr[0]; 
				sphVerts[j+5]=botColr[1]; 
				sphVerts[j+6]=botColr[2];	
			}
			else if(s%2==0){
					sphVerts[j+4]=equColr[0]; // equColr[0]; 
					sphVerts[j+5]=equColr[1]; // equColr[1]; 
					sphVerts[j+6]=equColr[2]; // equColr[2];					
			}
			else{
					sphVerts[j+4]=equ2Colr[0]; // equColr[0]; 
					sphVerts[j+5]=equ2Colr[1]; // equColr[1]; 
					sphVerts[j+6]=equ2Colr[2]; // equColr[2];					
			}
		}
	}
}

function makeBallon() {
//==============================================================================
// Make a sphere from one OpenGL TRIANGLE_STRIP primitive.   Make ring-like 
// equal-lattitude 'slices' of the sphere (bounded by planes of constant z), 
// and connect them as a 'stepped spiral' design (see makeCylinder) to build the
// sphere from one triangle strip.
  var slices = 13;		// # of slices of the sphere along the z axis. >=3 req'd
											// (choose odd # or prime# to avoid accidental symmetry)
  var sliceVerts	= 27;	// # of vertices around the top edge of the slice
											// (same number of vertices on bottom of slice, too)
  var sliceAngle = Math.PI/slices;	// lattitude angle spanned by one slice.

	// Create a (global) array to hold this sphere's vertices:
  ballonVerts = new Float32Array(  (((slices-1) * 2* sliceVerts) -1) * floatsPerVertex);
										// # of vertices * # of elements needed to store them. 
										// each slice requires 2*sliceVerts vertices except 1st and
										// last ones, which require only 2*sliceVerts-1.
										
	// Create dome-shaped top slice of sphere at z=+1
	// s counts slices; v counts vertices; 
	// j counts array elements (vertices * elements per vertex)
	var cos0 = 0.0;					// sines,cosines of slice's top, bottom edge.
	var sin0 = 0.0;
	var cos1 = 0.0;
	var sin1 = 0.0;	
	var j = 0;							// initialize our array index
	var isLast = 0;
	var isFirst = 1;
	for(s=0; s<slices-1; s++) {	// for each slice of the sphere,
		// find sines & cosines for top and bottom of this slice
		if(s==0) {
			isFirst = 1;	// skip 1st vertex of 1st slice.
			cos0 = 1.0; 	// initialize: start at north pole.
			sin0 = 0.0;
		}
		else {					// otherwise, new top edge == old bottom edge
			isFirst = 0;	
			cos0 = cos1;
			sin0 = sin1;
		}								// & compute sine,cosine for new bottom edge.
		cos1 = Math.cos((s+1)*sliceAngle)*(1+Math.sin(Math.PI/2*s/slices)*0.35);
		sin1 = Math.sin((s+1)*sliceAngle);
		// go around the entire slice, generating TRIANGLE_STRIP verts
		// (Note we don't initialize j; grows with each new attrib,vertex, and slice)
		for(v=isFirst; v< 2*sliceVerts-isLast; v++, j+=floatsPerVertex) {	
			if(v%2==0)
			{				// put even# vertices at the the slice's top edge
							// (why PI and not 2*PI? because 0 <= v < 2*sliceVerts
							// and thus we can simplify cos(2*PI(v/2*sliceVerts))  
				ballonVerts[j  ] = sin0 * Math.cos(Math.PI*(v)/sliceVerts); 	
				ballonVerts[j+1] = sin0 * Math.sin(Math.PI*(v)/sliceVerts);	
				ballonVerts[j+2] = cos0;		
				ballonVerts[j+3] = 1.0;			
			}
			else { 	// put odd# vertices around the slice's lower edge;
							// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
							// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
				ballonVerts[j  ] = sin1 * Math.cos(Math.PI*(v-1)/sliceVerts);		// x
				ballonVerts[j+1] = sin1 * Math.sin(Math.PI*(v-1)/sliceVerts);		// y
				ballonVerts[j+2] = cos1;																				// z
				ballonVerts[j+3] = 1.0;																				// w.		
			}
			if(s==0) {	// finally, set some interesting colors for vertices:
				ballonVerts[j+4]=1-Math.random()/2; 
				ballonVerts[j+5]=1-Math.random()/2; 
				ballonVerts[j+6]=1-Math.random()/2;	
				}
			else if(s%2==0){
					ballonVerts[j+4]=1-Math.random()/2; // equColr[0]; 
					ballonVerts[j+5]=1-Math.random()/2; // equColr[1]; 
					ballonVerts[j+6]=1-Math.random()/2; // equColr[2];					
			}
			else{
					ballonVerts[j+4]=1-Math.random()/2; // equColr[0]; 
					ballonVerts[j+5]=1-Math.random()/2; // equColr[1]; 
					ballonVerts[j+6]=1-Math.random()/2; // equColr[2];					
			}
		}
	}
}

function makeCone() {
//==============================================================================
// Make a sphere from one OpenGL TRIANGLE_STRIP primitive.   Make ring-like 
// equal-lattitude 'slices' of the sphere (bounded by planes of constant z), 
// and connect them as a 'stepped spiral' design (see makeCylinder) to build the
// sphere from one triangle strip.
											// (choose odd # or prime# to avoid accidental symmetry)
  var sliceVerts	= 54;	// # of vertices around the top edge of the slice
											// (same number of vertices on bottom of slice, too)
  var topColr = new Float32Array([1.0, 1.0, 0.8]);	// North Pole: light gray
  var equColr = new Float32Array([1.0, 1.0, 0.8]);	// Equator:    bright green
  var equ2Colr = new Float32Array([1.0, 1.0, 0.8]);	// Equator:    bright green
  var botColr = new Float32Array([1.0, 1.0, 0.8]);	// South Pole: brightest gray.

	// Create a (global) array to hold this sphere's vertices:
  coneVerts = new Float32Array(  ((2* sliceVerts) +1) * floatsPerVertex);
										// # of vertices * # of elements needed to store them. 
										// each slice requires 2*sliceVerts vertices except 1st and
										// last ones, which require only 2*sliceVerts-1.
										
	// Create dome-shaped top slice of sphere at z=+1
	// s counts slices; v counts vertices; 
	// j counts array elements (vertices * elements per vertex)
  for (var i = 0; i < sliceVerts; i++) {
	  if (i == 0) {
		  coneVerts[i] = Math.sin(Math.PI*i*2/sliceVerts);
		  coneVerts[i+1] = Math.cos(Math.PI*i*2/sliceVerts);
		  coneVerts[i+2] = 1.5;
		  coneVerts[i+3] = 1;
		  coneVerts[i+4] = 0.8;
		  coneVerts[i+5] = 0.6;
		  coneVerts[i+6] = 0;
	  }
	  for (var j = 0; j < 2; j++) {
		  if (j == 1) {
			coneVerts[(i*2+j+1)*7] = Math.sin(Math.PI*(i+1)*2/sliceVerts);
		  	coneVerts[(i*2+j+1)*7+1] = Math.cos(Math.PI*(i+1)*2/sliceVerts);
		    coneVerts[(i*2+j+1)*7+2] = 1.5;
		  }
		  else {
			coneVerts[(i*2+j+1)*7] = 0;
		  	coneVerts[(i*2+j+1)*7+1] = 0;
		    coneVerts[(i*2+j+1)*7+2] = 0;
		  }
		  coneVerts[(i*2+j+1)*7+3] = 1;
		  coneVerts[(i*2+j+1)*7+4] = 0.8;
		  coneVerts[(i*2+j+1)*7+5] = 0.6;
		  coneVerts[(i*2+j+1)*7+6] = 0;
	  }
  }
}

function makeWings() {
	var verts = 30;
	wingVerts = new Float32Array((verts * 2 * 2 + 1) * 7);
	for(var i = 0 ;i < verts *2; i++){
		if(i == 0) {
			wingVerts[i] = 1* Math.sin(Math.PI*i/verts*3/2);
			wingVerts[i+1] = 0.4 * Math.cos(Math.PI*i/verts*3/2);
			wingVerts[i+2] = 0.01;
			wingVerts[i+3] = 1;
			wingVerts[i+4] = 1.0;
			wingVerts[i+5] = 1.0;
			wingVerts[i+6] = 1.0;
		}
		for(var j = 0; j < 2; j++) {
			if(j==1){
				if(i<29){
					wingVerts[(i*2+j+1)*7] = 1* Math.sin(Math.PI*(i+1)/verts*3/2);
					wingVerts[(i*2+j+1)*7+1] = 0.4 * Math.cos(Math.PI*(i+1)/verts*3/2);
					wingVerts[(i*2+j+1)*7+2] = 0.01;
					wingVerts[(i*2+j+1)*7+3] = 1;
				}
				else if (i == 29){
					wingVerts[(i*2+j+1)*7] = 1* Math.sin(Math.PI*i/verts*3/2);
					wingVerts[(i*2+j+1)*7+1] = 0.4 * Math.cos(Math.PI*i/verts*3/2);
					wingVerts[(i*2+j+1)*7+2] = -0.01;
					wingVerts[(i*2+j+1)*7+3] = 1;
				}
				else if(i > 29 && i < 59){
					var k = 58-i;
					wingVerts[(i*2+j+1)*7] = 1* Math.sin(Math.PI*k/verts*3/2);
					wingVerts[(i*2+j+1)*7+1] = 0.4 * Math.cos(Math.PI*k/verts*3/2);
					wingVerts[(i*2+j+1)*7+2] = -0.01;
					wingVerts[(i*2+j+1)*7+3] = 1;
				}
				else if(i == 59){
					wingVerts[(i*2+j+1)*7] = 1* Math.sin(0);
					wingVerts[(i*2+j+1)*7+1] = 0.4 * Math.cos(0);
					wingVerts[(i*2+j+1)*7+2] = 0.01;
					wingVerts[(i*2+j+1)*7+3] = 1;
				}
			}
			else {
				wingVerts[(i*2+j+1)*7] = -0.5;
				wingVerts[(i*2+j+1)*7+1] = 0.2
				wingVerts[(i*2+j+1)*7+2] = 0;
				wingVerts[(i*2+j+1)*7+3] = 1;
			}
			wingVerts[(i*2+j+1)*7+4] = 0.8;
			wingVerts[(i*2+j+1)*7+5] = 1.0;
			wingVerts[(i*2+j+1)*7+6] = 1.0;
		}
	}
}

function makeTorus() {
//==============================================================================
// 		Create a torus centered at the origin that circles the z axis.  
// Terminology: imagine a torus as a flexible, cylinder-shaped bar or rod bent 
// into a circle around the z-axis. The bent bar's centerline forms a circle
// entirely in the z=0 plane, centered at the origin, with radius 'rbend'.  The 
// bent-bar circle begins at (rbend,0,0), increases in +y direction to circle  
// around the z-axis in counter-clockwise (CCW) direction, consistent with our
// right-handed coordinate system.
// 		This bent bar forms a torus because the bar itself has a circular cross-
// section with radius 'rbar' and angle 'phi'. We measure phi in CCW direction 
// around the bar's centerline, circling right-handed along the direction 
// forward from the bar's start at theta=0 towards its end at theta=2PI.
// 		THUS theta=0, phi=0 selects the torus surface point (rbend+rbar,0,0);
// a slight increase in phi moves that point in -z direction and a slight
// increase in theta moves that point in the +y direction.  
// To construct the torus, begin with the circle at the start of the bar:
//					xc = rbend + rbar*cos(phi); 
//					yc = 0; 
//					zc = -rbar*sin(phi);			(note negative sin(); right-handed phi)
// and then rotate this circle around the z-axis by angle theta:
//					x = xc*cos(theta) - yc*sin(theta) 	
//					y = xc*sin(theta) + yc*cos(theta)
//					z = zc
// Simplify: yc==0, so
//					x = (rbend + rbar*cos(phi))*cos(theta)
//					y = (rbend + rbar*cos(phi))*sin(theta) 
//					z = -rbar*sin(phi)
// To construct a torus from a single triangle-strip, make a 'stepped spiral' 
// along the length of the bent bar; successive rings of constant-theta, using 
// the same design used for cylinder walls in 'makeCyl()' and for 'slices' in 
// makeSphere().  Unlike the cylinder and sphere, we have no 'special case' 
// for the first and last of these bar-encircling rings.
//
var rbend = 1.0;										// Radius of circle formed by torus' bent bar
var rbar = 0.5;											// radius of the bar we bent to form torus
var barSlices = 23;									// # of bar-segments in the torus: >=3 req'd;
																		// more segments for more-circular torus
var barSides = 13;										// # of sides of the bar (and thus the 
																		// number of vertices in its cross-section)
																		// >=3 req'd;
																		// more sides for more-circular cross-section
// for nice-looking torus with approx square facets, 
//			--choose odd or prime#  for barSides, and
//			--choose pdd or prime# for barSlices of approx. barSides *(rbend/rbar)
// EXAMPLE: rbend = 1, rbar = 0.5, barSlices =23, barSides = 11.

	// Create a (global) array to hold this torus's vertices:
 torVerts = new Float32Array(floatsPerVertex*(2*barSides*barSlices +2));
//	Each slice requires 2*barSides vertices, but 1st slice will skip its first 
// triangle and last slice will skip its last triangle. To 'close' the torus,
// repeat the first 2 vertices at the end of the triangle-strip.  Assume 7

var phi=0, theta=0;										// begin torus at angles 0,0
var thetaStep = 2*Math.PI/barSlices;	// theta angle between each bar segment
var phiHalfStep = Math.PI/barSides;		// half-phi angle between each side of bar
																			// (WHY HALF? 2 vertices per step in phi)
	// s counts slices of the bar; v counts vertices within one slice; j counts
	// array elements (Float32) (vertices*#attribs/vertex) put in torVerts array.
	for(s=0,j=0; s<barSlices; s++) {		// for each 'slice' or 'ring' of the torus:
		for(v=0; v< 2*barSides; v++, j+=7) {		// for each vertex in this slice:
			if(v%2==0)	{	// even #'d vertices at bottom of slice,
				torVerts[j  ] = (rbend + rbar*Math.cos((v)*phiHalfStep)) * 
																						 Math.cos((s)*thetaStep);
							  //	x = (rbend + rbar*cos(phi)) * cos(theta)
				torVerts[j+1] = (rbend + rbar*Math.cos((v)*phiHalfStep)) *
																						 Math.sin((s)*thetaStep);
								//  y = (rbend + rbar*cos(phi)) * sin(theta) 
				torVerts[j+2] = -rbar*Math.sin((v)*phiHalfStep);
								//  z = -rbar  *   sin(phi)
				torVerts[j+3] = 1.0;		// w
			}
			else {				// odd #'d vertices at top of slice (s+1);
										// at same phi used at bottom of slice (v-1)
				torVerts[j  ] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) * 
																						 Math.cos((s+1)*thetaStep);
							  //	x = (rbend + rbar*cos(phi)) * cos(theta)
				torVerts[j+1] = (rbend + rbar*Math.cos((v-1)*phiHalfStep)) *
																						 Math.sin((s+1)*thetaStep);
								//  y = (rbend + rbar*cos(phi)) * sin(theta) 
				torVerts[j+2] = -rbar*Math.sin((v-1)*phiHalfStep);
								//  z = -rbar  *   sin(phi)
				torVerts[j+3] = 1.0;		// w
			}
			torVerts[j+4] = 1.0;		// random color 0.0 <= R < 1.0
			torVerts[j+5] = 1.0;		// random color 0.0 <= G < 1.0
			torVerts[j+6] = 0.8;		// random color 0.0 <= B < 1.0
		}
	}
	// Repeat the 1st 2 vertices of the triangle strip to complete the torus:
			torVerts[j  ] = rbend + rbar;	// copy vertex zero;
						  //	x = (rbend + rbar*cos(phi==0)) * cos(theta==0)
			torVerts[j+1] = 0.0;
							//  y = (rbend + rbar*cos(phi==0)) * sin(theta==0) 
			torVerts[j+2] = 0.0;
							//  z = -rbar  *   sin(phi==0)
			torVerts[j+3] = 1.0;		// w
			torVerts[j+4] = 1.0;		// random color 0.0 <= R < 1.0
			torVerts[j+5] = 1.0;		// random color 0.0 <= G < 1.0
			torVerts[j+6] = 0.8;		// random color 0.0 <= B < 1.0
			j+=7; // go to next vertex:
			torVerts[j  ] = (rbend + rbar) * Math.cos(thetaStep);
						  //	x = (rbend + rbar*cos(phi==0)) * cos(theta==thetaStep)
			torVerts[j+1] = (rbend + rbar) * Math.sin(thetaStep);
							//  y = (rbend + rbar*cos(phi==0)) * sin(theta==thetaStep) 
			torVerts[j+2] = 0.0;
							//  z = -rbar  *   sin(phi==0)
			torVerts[j+3] = 1.0;		// w
			torVerts[j+4] = 1.0;		// random color 0.0 <= R < 1.0
			torVerts[j+5] = 1.0;		// random color 0.0 <= G < 1.0
			torVerts[j+6] = 0.8;		// random color 0.0 <= B < 1.0
}

function makeBasket() {
	basketVerts = new Float32Array([
	 -0.05, -0.05, 0.05, 1.00,		0.8, 0.6, 0.0,//robot arm
     0.05, -0.05, 0.05, 1.00,    0.8, 0.6, 0.0,
     -0.05,  0.05, 0.05, 1.00,   0.8, 0.6, 0.0,
     0.05, -0.05, 0.05, 1.00,		0.8, 0.6, 0.0,
     0.05, 0.05, 0.05, 1.00,    0.8, 0.6, 0.0,
     -0.05, 0.05, 0.05, 1.00,    0.8, 0.6, 0.0,
     -0.05, -0.05, 0.05, 1.00,    0.2, 0.6, 0.0,
     -0.05, 0.05, 0.05, 1.00,    0.2, 0.6, 0.0,
     -0.05, -0.05, -0.05, 1.00,   0.2, 0.6, 0.0,
     -0.05, -0.05, -0.05, 1.00,    0.2, 0.6, 0.0,
     -0.05, 0.05, 0.05, 1.00,   0.2, 0.6, 0.0,
     -0.05, 0.05, -0.05, 1.00,   0.2, 0.6, 0.0,
     -0.05, -0.05, -0.05, 1.00,		0.8, 0.6, 0.5,
     -0.05,  0.05, -0.05, 1.00,   0.8, 0.6, 0.5,
     0.05, -0.05, -0.05, 1.00,    0.8, 0.6, 0.5,
     0.05, -0.05, -0.05, 1.00,		0.8, 0.6, 0.5,
     -0.05, 0.05, -0.05, 1.00,   0.8, 0.6, 0.5,
     0.05, 0.05, -0.05, 1.00,   0.8, 0.6, 0.5,
     0.05, -0.05, 0.05, 1.00,   0.8, 0.1, 0.0,
     0.05, -0.05, -0.05, 1.00,   0.8, 0.1, 0.0,
     0.05, 0.05, 0.05, 1.00,    0.8, 0.1, 0.0,
     0.05, -0.05, -0.05, 1.00,    0.8, 0.1, 0.0,
     0.05, 0.05, -0.05, 1.00,   0.8, 0.1, 0.0,
     0.05, 0.05, 0.05, 1.00,    0.8, 0.1, 0.0,
     -0.05, -0.05, 0.05, 1.00,		0.2, 0.6, 0.9,
     0.05, -0.05, 0.05, 1.00,    0.2, 0.6, 0.9,
     -0.05,  -0.05, -0.05, 1.00,   0.2, 0.6, 0.9,
     0.05, -0.05, 0.05, 1.00,		0.2, 0.6, 0.9,
     0.05, -0.05, -0.05, 1.00,     0.2, 0.6, 0.9,
     -0.05, -0.05, -0.05, 1.00,    0.2, 0.6, 0.9,
	]);
}

function makePyramid() {
	pyramidVerts = new Float32Array([
	 0.05, 0.00, 0.00, 1.00,		0.8, 0.6, 0.0,//robot arm
     0.00, 0.00, 0.05, 1.00,    0.8, 0.6, 0.0,
     0.00,  0.05, 0.00, 1.00,   0.8, 0.6, 0.0,
     0.05, 0.00, 0.00, 1.00,		0.7, 0.5, 0.0,
     0.00, -0.05, 0.00, 1.00,    0.7, 0.5, 0.0,
     0.00, 0.00, 0.05, 1.00,    0.7, 0.5, 0.0,
     0.00, -0.05, 0.00, 1.00,    0.2, 0.6, 0.0,
     0.00, 0.00, 0.05, 1.00,    0.2, 0.6, 0.0,
     -0.05, 0.00, 0.00, 1.00,   0.2, 0.6, 0.0,
     -0.05, 0.00, 0.00, 1.00,    0.5, 0.6, 0.0,
     0.00, 0.00, 0.05, 1.00,   0.5, 0.6, 0.0,
     0.00, 0.05, 0.00, 1.00,   0.5, 0.6, 0.0,
     0.05, 0.00, 0.00, 1.00,		0.8, 0.6, 0.5,
     0.00,  0.05, 0.00, 1.00,   0.8, 0.6, 0.5,
     -0.05, 0.00, 0.00, 1.00,    0.8, 0.6, 0.5,
     -0.05, 0.00, 0.00, 1.00,		0.7, 0.3, 0.0,
     0.00, -0.05, 0.00, 1.00,   0.7, 0.3, 0.0,
     0.05, 0.00, 0.00, 1.00,   0.7, 0.3, 0.0,
	]);
}


function makeGroundGrid() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	var xcount = 100;			// # of lines to draw in x,y to make the grid.
	var ycount = 100;		
	var xymax	= 50.0;			// grid size; extends to cover +/-xymax in x and y.
 	var xColr = new Float32Array([1.0, 1.0, 0.3]);	// bright yellow
 	var yColr = new Float32Array([0.5, 1.0, 0.5]);	// bright green.
 	
	// Create an (global) array to hold this ground-plane's vertices:
	gndVerts = new Float32Array(floatsPerVertex*2*(xcount+ycount));
						// draw a grid made of xcount+ycount lines; 2 vertices per line.
						
	var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
	var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
	
	// First, step thru x values as we make vertical lines of constant-x:
	for(v=0, j=0; v<2*xcount; v++, j+= floatsPerVertex) {
		if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			gndVerts[j  ] = -xymax + (v  )*xgap;	// x
			gndVerts[j+1] = -xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {				// put odd-numbered vertices at (xnow, +xymax, 0).
			gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
			gndVerts[j+1] = xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = xColr[0];			// red
		gndVerts[j+5] = xColr[1];			// grn
		gndVerts[j+6] = xColr[2];			// blu
	}
	// Second, step thru y values as wqe make horizontal lines of constant-y:
	// (don't re-initialize j--we're adding more vertices to the array)
	for(v=0; v<2*ycount; v++, j+= floatsPerVertex) {
		if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
			gndVerts[j  ] = -xymax;								// x
			gndVerts[j+1] = -xymax + (v  )*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {					// put odd-numbered vertices at (+xymax, ynow, 0).
			gndVerts[j  ] = xymax;								// x
			gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = yColr[0];			// red
		gndVerts[j+5] = yColr[1];			// grn
		gndVerts[j+6] = yColr[2];			// blu
	}
}

function makeAxis(){
	AxisVerts = new Float32Array([2,0,0,1,1,0,0,
	0,0,0,1,1,0,0,
	0,2,0,1,0,1,0,
	0,0,0,1,0,1,0,
	0,0,0,1,0,0,1,
	0,0,2,1,0,0,1,]);
}

function drawAll(gl, n, currentAngle, modelMatrix, u_ModelMatrix) {
//==============================================================================
  // Clear <canvas>  colors AND the depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  modelMatrix.setIdentity();    // DEFINE 'world-space' coords.

  var vpAspect = (canvas.width/2) /canvas.height;	// this camera: width/height.
  var PM = new Matrix4();
  var VM = new Matrix4();
  PM.setPerspective(40.0-cameraX,vpAspect,1.0,1000.0);
  VM.setLookAt(5+cameraYX,0+cameraYY,2,5+cameraYX-Math.cos(Math.PI*cameraAngleY/180)*6*Math.cos(Math.PI*cameraAngleX/180),0+cameraYY+Math.sin(Math.PI*cameraAngleY/180)*6*Math.cos(Math.PI*cameraAngleX/180),-1.5+7*Math.sin(Math.PI*cameraAngleX/180),0,0,1);
  
  for (var i = 0; i < 2; i++){
	  if (i == 0) {
				  
  gl.viewport(0,											// Viewport lower-left corner
				0, 			// location(in pixels)
  				canvas.width/2, 				// viewport width,
  				canvas.height);			// viewport height in pixels.
  PM.setPerspective(40.0-cameraX,vpAspect,1.0,1000.0);
	  }
	  else {

	  gl.viewport(canvas.width/2,											// Viewport lower-left corner
				0, 			// location(in pixels)
  				canvas.width/2, 				// viewport width,
  				canvas.height);			// viewport height in pixels.
				  
  PM.setOrtho(-2.5+cameraX/15,2.5-cameraX/15,(-2.5+cameraX/15)*canvas.height/(canvas.width/2),(2.5-cameraX/15)*canvas.height/(canvas.width/2),1,1000);
	  }
/*
// STEP 2: add in a 'perspective()' function call here to define 'camera lens':
  modelMatrix.perspective(	??,   // FOVY: top-to-bottom vertical image angle, in degrees
                            ??,   // Image Aspect Ratio: camera lens width/height
                           	??,   // camera z-near distance (always positive; frustum begins at z = -znear)
                        		??);  // camera z-far distance (always positive; frustum ends at z = -zfar)

*/

/*
//  STEP 1:
// Make temporary view matrix that is still close to the origin and
// won't lose sight of our current CVV contents when used without 
// a properly-constructed projection matrix.
//TEMPORARY: 1/10th size camera pose to see what's in CVV locations
  modelMatrix.lookAt( ??, ??, ??,	// center of projection
                      ??, ??, ??,	// look-at point 
                      ??, ??, ??);	// View UP vector.
*/


/* STEP 3: 
//Replace the temporary view matrix with your final view matrix...
// GOAL: camera positioned at 3D point (5,5,3), looking at the 
//       3D point (-1,-2,-0.5),  using up vector (0,0,1).

  modelMatrix.lookAt( ??, ??, ??,	// center of projection
                      ??, ??, ??,	// look-at point 
                      ??, ??, ??);	// View UP vector.
*/
  //===========================================================
  //
  modelMatrix.setTranslate(0,0,0);
  pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	modelMatrix.scale(0.1, 0.1, 0.1);				// shrink by 10X:

  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix	.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  gndStart/floatsPerVertex,	// start at this vertex number, and
    						  gndVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

  pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix	.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  axisStart/floatsPerVertex,	// start at this vertex number, and
    						  AxisVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.*/
  //==========================head=================================
    //--------Draw Spinning Sphere
  	colorChange(0);
	modelMatrix.translate(0,0,0.3+bodyAngle/300);
	//modelMatrix.rotate(-90,0,0,1);
//    modelMatrix.rotate(currentAngle, 0, 0, 1);  // Spin on XY diagonal axis
    pushMatrix(modelMatrix);  // SAVE world drawing coords.
    modelMatrix.rotate(-15, 0, 1, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.15,0.15,0.27);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							sphStart/floatsPerVertex,	// start at this vertex number, and 
    							sphVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  //=======================antenna============================
   pushMatrix(modelMatrix);  // SAVE world drawing coords.
	modelMatrix.translate(0.2,0.08,0.1);
    modelMatrix.rotate(65, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(-20, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.01,0.01,0.1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
	  
   pushMatrix(modelMatrix);  // SAVE world drawing coords.
	modelMatrix.translate(0.35,0.17,0.02);
    modelMatrix.rotate(-25, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(20, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.01,0.01,0.15);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	pushMatrix(modelMatrix);  // SAVE world drawing coords.
	modelMatrix.translate(0.2,-0.08,0.1);
    modelMatrix.rotate(65, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(20, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.01,0.01,0.1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
	  
   pushMatrix(modelMatrix);  // SAVE world drawing coords.
	modelMatrix.translate(0.35,-0.17,0.02);
    modelMatrix.rotate(-25, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(-20, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.01,0.01,0.15);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  //=======================chest==============================
  	colorChange(1);
//    modelMatrix.rotate(currentAngle, 0, 0, 1);  // Spin on XY diagonal axis
    pushMatrix(modelMatrix);  // SAVE world drawing coords.
	modelMatrix.translate(0.04,0.0,0.0);
    modelMatrix.rotate(-15, 0, 1, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.10,0.18,0.18);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							sphStart/floatsPerVertex,	// start at this vertex number, and 
    							sphVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  
	modelMatrix.translate(-0.4,0.0,0.03);
//    modelMatrix.rotate(currentAngle, 0, 0, 1);  // Spin on XY diagonal axis
    pushMatrix(modelMatrix);  // SAVE world drawing coords.
    modelMatrix.rotate(90, 0, 1, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.21,0.21,0.3);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							sphStart/floatsPerVertex,	// start at this vertex number, and 
    							sphVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

//==============================front leg===============================

	var originMatirx = new Matrix4();
	pushMatrix(modelMatrix);
	originMatirx = popMatrix();
	modelMatrix.translate(0.15,0.2,-0.1);
	pushMatrix(modelMatrix);
    modelMatrix.rotate(45+bodyAngle, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(-45, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.03,0.03,0.1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	modelMatrix.translate(0.165-bodyAngle/390,0.23-bodyAngle/240,-0.07-bodyAngle/990*(1+Math.sin(Math.PI*bodyAngle/90)*2.5));
    modelMatrix.rotate(-45+bodyAngle, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(45-bodyAngle, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.02,0.02,0.25);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
								
	pushMatrix(originMatirx);
  	modelMatrix = popMatrix(); // RESTORE 'world' drawing coords.

	modelMatrix.translate(0.15,-0.2,-0.1-bodyAngle/1800);
	pushMatrix(modelMatrix);  // SAVE world drawing coords.
    modelMatrix.rotate(45+bodyAngle, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(45, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.03,0.03,0.1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	
	modelMatrix.translate(0.165-bodyAngle/390,-0.23+bodyAngle/270,-0.07-bodyAngle/990*(1+Math.sin(Math.PI*bodyAngle/90)*2.5));
    modelMatrix.rotate(-45+bodyAngle, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(-45+bodyAngle, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.02,0.02,0.25);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
	pushMatrix(originMatirx);
  	modelMatrix = popMatrix(); // RESTORE 'world' drawing coords.
//================================middle leg==================================
	modelMatrix.translate(0.0,0.2,-0.1-bodyAngle/1800);
    pushMatrix(modelMatrix);  // SAVE world drawing coords.
    modelMatrix.rotate(-45-bodyAngle, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.03,0.03,0.1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	
	modelMatrix.translate(0.0,0.23-bodyAngle/270,-0.1-bodyAngle/900*(1+Math.sin(Math.PI*bodyAngle/90)*2.3));
    modelMatrix.rotate(45-bodyAngle, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.02,0.02,0.25);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
	pushMatrix(originMatirx);
  	modelMatrix = popMatrix(); // RESTORE 'world' drawing coords.

	modelMatrix.translate(0.0,-0.2,-0.1-bodyAngle/1800);
	      pushMatrix(modelMatrix);  // SAVE world drawing coords.
    modelMatrix.rotate(45+bodyAngle, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.03,0.03,0.1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	
	modelMatrix.translate(0.0,-0.23+bodyAngle/270,-0.10-bodyAngle/900*(1+Math.sin(Math.PI*bodyAngle/90)*2.3));
    modelMatrix.rotate(-45+bodyAngle, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.02,0.02,0.25);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
	pushMatrix(originMatirx);
  	modelMatrix = popMatrix(); // RESTORE 'world' drawing coords.
//================================hind leg===================================
	modelMatrix.translate(-0.15,0.2,-0.1)-bodyAngle/1800;
	pushMatrix(modelMatrix);  // SAVE world drawing coords.
    modelMatrix.rotate(-60-bodyAngle, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(-30, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.03,0.03,0.1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	
	modelMatrix.translate(-0.35+bodyAngle/220,0.14-bodyAngle/380,-0.12-bodyAngle/480*(1+Math.sin(Math.PI*bodyAngle/90)));
    modelMatrix.rotate(60-bodyAngle, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(15-bodyAngle/2, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.02,0.02,0.35);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
	pushMatrix(originMatirx);
  	modelMatrix = popMatrix(); // RESTORE 'world' drawing coords.

	modelMatrix.translate(-0.15,-0.2,-0.1-bodyAngle/1800);
	pushMatrix(modelMatrix);  // SAVE world drawing coords.
    modelMatrix.rotate(-60-bodyAngle, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(30, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.03,0.03,0.1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	
	modelMatrix.translate(-0.35+bodyAngle/220,-0.14+bodyAngle/380,-0.12-bodyAngle/480*(1+Math.sin(Math.PI*bodyAngle/90)));
    modelMatrix.rotate(60-bodyAngle, 0, 1, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(-15+bodyAngle/2, 1, 0, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.02,0.02,0.35);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
	pushMatrix(originMatirx);
  	modelMatrix = popMatrix(); // RESTORE 'world' drawing coords.
//============================wings=======================================
    pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	modelMatrix.translate(-0.4+0.4*wingAngle/180,0.3+0.4*wingAngle/180,0.25*-Math.sin(Math.PI*wingAngleVert/180)+0.1+0.1*Math.cos(Math.PI*wingAngle/180/2));
	modelMatrix.scale(0.7,0.7,0.7);
    modelMatrix.rotate(150-wingAngle/3, 0, 0, 1);  // Spin on XY diagonal axis
    modelMatrix.rotate(20, 1, 0, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(25*Math.sin(Math.PI*wingAngleVert/180)-5, 0, 1, 0);  // Spin on XY diagonal axis
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							wingStart/floatsPerVertex,	// start at this vertex number, and 
    							wingVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.


	pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	modelMatrix.translate(-0.6+0.3*wingAngle/180,0.3+0.3*wingAngle/180,0.25*-Math.sin(Math.PI*wingAngleVert/180)+0.1+0.1*Math.cos(Math.PI*wingAngle/180/2));
	modelMatrix.scale(0.6,0.6,0.6);
    modelMatrix.rotate(150-wingAngle/3, 0, 0, 1);  // Spin on XY diagonal axis
    modelMatrix.rotate(27, 1, 0, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(25*Math.sin(Math.PI*wingAngleVert/180)-5, 0, 1, 0);  // Spin on XY diagonal axis
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							wingStart/floatsPerVertex,	// start at this vertex number, and 
    							wingVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

	  
    pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	modelMatrix.translate(-0.4+0.4*wingAngle/180,-0.3-0.4*wingAngle/180,-0.25*Math.sin(Math.PI*wingAngleVert/180)+0.1+0.1*Math.cos(Math.PI*wingAngle/180/2));
	modelMatrix.scale(0.7,0.7,0.7);
    modelMatrix.rotate(210+wingAngle/3, 0, 0, 1);  // Spin on XY diagonal axis
    modelMatrix.rotate(-200, 1, 0, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(-25*Math.sin(Math.PI*wingAngleVert/180)+5, 0, 1, 0);  // Spin on XY diagonal axis
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							wingStart/floatsPerVertex,	// start at this vertex number, and 
    							wingVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

    pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	modelMatrix.translate(-0.6+0.3*wingAngle/180,-0.3-0.3*wingAngle/180,-0.25*Math.sin(Math.PI*wingAngleVert/180)+0.1+0.1*Math.cos(Math.PI*wingAngle/180/2));
	modelMatrix.scale(0.6,0.6,0.6);
    modelMatrix.rotate(210+wingAngle/3, 0, 0, 1);  // Spin on XY diagonal axis
    modelMatrix.rotate(-207, 1, 0, 0);  // Spin on XY diagonal axis
    modelMatrix.rotate(-25*Math.sin(Math.PI*wingAngleVert/180)+5, 0, 1, 0);  // Spin on XY diagonal axis
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							wingStart/floatsPerVertex,	// start at this vertex number, and 
    							wingVerts.length/floatsPerVertex);	// draw this many vertices.
  	modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
	
//================================stomach=====================================
  	colorChange(2);
	modelMatrix.translate(-0.8,0.0,0.0-bodyAngle/900	);
    pushMatrix(modelMatrix);  // SAVE world drawing coords.
    modelMatrix.rotate(90-bodyAngle/6, 0, 1, 0);  // Spin on XY diagonal axis
	modelMatrix.scale(0.3,0.35,0.6);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
	mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							sphStart/floatsPerVertex,	// start at this vertex number, and 
    							sphVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
//=============================chess==========================================
  modelMatrix.setTranslate(0,2,0);
  pushMatrix(modelMatrix);
  modelMatrix.scale(0.25,0.25,0.05);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();

  modelMatrix.translate(0,0,0.1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(0.15,0.15,0.15);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 torStart/floatsPerVertex,	// start at this vertex number, and 
    							torVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();
  
  modelMatrix.translate(0,0,0.1);
  pushMatrix(modelMatrix);
  modelMatrix.scale(0.15,0.15,0.01);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();

  
  modelMatrix.translate(0,0,0.1);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180,0,1,0);
  modelMatrix.scale(0.14,0.14,0.3);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 cyl2Start/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();

  
  modelMatrix.translate(0,0,0.3);
  pushMatrix(modelMatrix);
  modelMatrix.rotate(180,0,1,0);
  modelMatrix.scale(0.17,0.17,0.02);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 cyl2Start/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();

  
  modelMatrix.translate(0,0,0.15);
  pushMatrix(modelMatrix);
  modelMatrix.scale(0.15,0.15,0.15);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 whiteSphereStart/floatsPerVertex,	// start at this vertex number, and 
    							sphVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();
  //=============================ice cream==========================================
  modelMatrix.setTranslate(0,-2,0);
  pushMatrix(modelMatrix);
  modelMatrix.scale(0.2,0.2,0.4);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 coneStart/floatsPerVertex,	// start at this vertex number, and 
    							coneVerts.length/floatsPerVertex);	// draw this many vertices.	
  modelMatrix = popMatrix();

  modelMatrix.translate(0,0,0.61);
  pushMatrix(modelMatrix);
  modelMatrix.scale(0.19,0.19,0.19);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 whiteSphereStart/floatsPerVertex,	// start at this vertex number, and 
    							sphVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();

  //=============================hot air ballon==========================================
  modelMatrix.setTranslate(-2,0,0.8);
  pushMatrix(modelMatrix);
  modelMatrix.scale(0.3,0.3,0.3);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 ballonStart/floatsPerVertex,	// start at this vertex number, and 
    							ballonVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();
  
  pushMatrix(modelMatrix);
  modelMatrix.translate(0,0.05,-0.45);
  modelMatrix.rotate(30,1,0,0);
  modelMatrix.scale(0.005,0.005,0.05);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();

  pushMatrix(modelMatrix);
  modelMatrix.translate(0,-0.05,-0.45);
  modelMatrix.rotate(-30,1,0,0);
  modelMatrix.scale(0.005,0.005,0.05);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();

  
  pushMatrix(modelMatrix);
  modelMatrix.translate(0.05,0,-0.45);
  modelMatrix.rotate(-30,0,1,0);
  modelMatrix.scale(0.005,0.005,0.05);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.

  modelMatrix = popMatrix();
  pushMatrix(modelMatrix);
  modelMatrix.translate(-0.05,0,-0.45);
  modelMatrix.rotate(30,0,1,0);
  modelMatrix.scale(0.005,0.005,0.05);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							 cylStart/floatsPerVertex,	// start at this vertex number, and 
    							cylVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();

  pushMatrix(modelMatrix);
  
  modelMatrix.translate(0,0,-0.54);
  modelMatrix.rotate(45,0,0,1);
  modelMatrix.rotate(90,1,0,0);
  modelMatrix.scale(1.1,1.1,1.1);
  mvpMatrix = new Matrix4();
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLES,				// use this drawing primitive, and
    							 basketStart/floatsPerVertex,	// start at this vertex number, and 
    							basketVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();
  //=============================pyramid===============================
    modelMatrix.setTranslate(2,0,0);
  mvpMatrix = new Matrix4();
    modelMatrix.scale(8,8,8);
	quatMatrix.setFromQuat(qTot.z, qTot.x, qTot.y, qTot.w);	// Quaternion-->Matrix
	modelMatrix.concat(quatMatrix);	// apply that matrix.
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLES,				// use this drawing primitive, and
    							 pyramidStart/floatsPerVertex,	// start at this vertex number, and 
    							pyramidVerts.length/floatsPerVertex);	// draw this many vertices.\
    // Draw just the ground-plane's vertices
    modelMatrix.scale(0.05,0.05,0.05);
	mvpMatrix.set(PM).multiply(VM).multiply(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, mvpMatrix.elements)
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  axisStart/floatsPerVertex,	// start at this vertex number, and
    						  AxisVerts.length/floatsPerVertex);	// draw this many vertices.
  }
}

// Last time that this function was called:  (used for animation timing)
var g_last = Date.now();

function animate(angle) {
//==============================================================================
  // Calculate the elapsed time
  var now = Date.now();
  var elapsed = now - g_last;
  g_last = now;    
  // Update the current rotation angle (adjusted by the elapsed time)
  //  limit the angle to move smoothly between +20 and -85 degrees:
//  if(angle >  120.0 && ANGLE_STEP > 0) ANGLE_STEP = -ANGLE_STEP;
//  if(angle < -120.0 && ANGLE_STEP < 0) ANGLE_STEP = -ANGLE_STEP;
  
  var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
  return newAngle %= 360;
}

//==================HTML Button Callbacks
function nextShape() {
	shapeNum += 1;
	if(shapeNum >= shapeMax) shapeNum = 0;
}

function spinDown() {
 ANGLE_STEP -= 25; 
}

function spinUp() {
  ANGLE_STEP += 25; 
}

function runStop() {
  if(ANGLE_STEP*ANGLE_STEP > 1) {
    myTmp = ANGLE_STEP;
    ANGLE_STEP = 0;
  }
  else {
  	ANGLE_STEP = myTmp;
  }
}
 
 function colorChange(type){
	 if(type == 0){
	 	for(var i = 4; i < sphVerts.length; i+=7){
			 sphVerts[i] = 1.0;
			 sphVerts[i+1] = 0.8;
			 sphVerts[i+2] = 0.0;
			}
	 }
	 else if(type == 1){
		 for(var i = 4; i < sphVerts.length; i+=7){
			 sphVerts[i] = 0.2;
			 sphVerts[i+1] = 0.1;
			 sphVerts[i+2] = 0.1;
			}
	 }
	 else if(type == 2){
		 for(var i = 4, j = 0, k = 0; i < sphVerts.length; i += 7, j++){
			 if(j == 54){
				 j = 0;
				 k++;
			 }
			 if(k % 2 == 0){
				 sphVerts[i] = 1.0;
				 sphVerts[i+1] = 0.8;
				 sphVerts[i+2] = 0.0;
			 }
			 else{
			 	sphVerts[i] = 0.2;
			 	sphVerts[i+1] = 0.1;
			 	sphVerts[i+2] = 0.1;
			 }
			}
	 }
	gl.bindBuffer(gl.ARRAY_BUFFER,shapeBufferHandle);
	gl.bufferSubData(gl.ARRAY_BUFFER,0,sphVerts);
	gl.bindBuffer(gl.ARRAY_BUFFER,null);
 }

 function myKeyDown(kev) {
	switch(kev.code) {
		case "ArrowLeft": 	
      animateKey(0);
			break;
		case "ArrowRight":
      animateKey(1);
  		break;
		case "ArrowUp":
      animateKey(2);
  		break;
		case "ArrowDown":
      animateKey(3);
  		break;
		case "KeyA":
      animateKey(4);
  		break;
		case "KeyD":
      animateKey(5);
  		break;
		case "KeyW":
      animateKey(6);
  		break;
		case "KeyS":
      animateKey(7);
  		break;
		case "KeyK":
		g_last = Date.now();
		flag = 1
  		break;
		case "KeyL":
		flag = 3
  		break;
    default:
      break;
	}
}

function myMouseDown(ev, gl, canvas) {
//==============================================================================
// Called when user PRESSES down any mouse button;
// 									(Which button?    console.log('ev.button='+ev.button);   )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
  var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseDown(pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);
//	console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);
	
	isDrag = true;											// set our mouse-dragging flag
	xMclik = x;													// record where mouse-dragging began
	yMclik = y;
};


function myMouseMove(ev, gl, canvas) {
//==============================================================================
// Called when user MOVES the mouse with a button already pressed down.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

	if(isDrag==false) return;				// IGNORE all mouse-moves except 'dragging'

	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);

	// find how far we dragged the mouse:
	xMdragTot += (x - xMclik);					// Accumulate change-in-mouse-position,&
	yMdragTot += (y - yMclik);
	// AND use any mouse-dragging we found to update quaternions qNew and qTot.
	dragQuat(x - xMclik, y - yMclik);
	
	xMclik = x;													// Make NEXT drag-measurement from here.
	yMclik = y;
	
	// Show it on our webpage, in the <div> element named 'MouseText':
};

function myMouseUp(ev, gl, canvas) {
//==============================================================================
// Called when user RELEASES mouse button pressed previously.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
  						 (canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							 (canvas.height/2);
//	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);
	
	isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:
	xMdragTot += (x - xMclik);
	yMdragTot += (y - yMclik);
//	console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);

	// AND use any mouse-dragging we found to update quaternions qNew and qTot;
	dragQuat(x - xMclik, y - yMclik);

	// Show it on our webpage, in the <div> element named 'MouseText':	
};

function dragQuat(xdrag, ydrag) {
//==============================================================================
// Called when user drags mouse by 'xdrag,ydrag' as measured in CVV coords.
// We find a rotation axis perpendicular to the drag direction, and convert the 
// drag distance to an angular rotation amount, and use both to set the value of 
// the quaternion qNew.  We then combine this new rotation with the current 
// rotation stored in quaternion 'qTot' by quaternion multiply.  Note the 
// 'draw()' function converts this current 'qTot' quaternion to a rotation 
// matrix for drawing. 
	var res = 5;
	var qTmp = new Quaternion(0,0,0,1);
	
	var dist = Math.sqrt(xdrag*xdrag + ydrag*ydrag);
	// console.log('xdrag,ydrag=',xdrag.toFixed(5),ydrag.toFixed(5),'dist=',dist.toFixed(5));
	qNew.setFromAxisAngle(-ydrag + 0.0001, xdrag + 0.0001, 0.0, dist*150.0);
	// (why add tiny 0.0001? To ensure we never have a zero-length rotation axis)
							// why axis (x,y,z) = (-yMdrag,+xMdrag,0)? 
							// -- to rotate around +x axis, drag mouse in -y direction.
							// -- to rotate around +y axis, drag mouse in +x direction.
							
	qTmp.multiply(qNew,qTot);			// apply new rotation to current rotation. 
	//--------------------------
	// IMPORTANT! Why qNew*qTot instead of qTot*qNew? (Try it!)
	// ANSWER: Because 'duality' governs ALL transformations, not just matrices. 
	// If we multiplied in (qTot*qNew) order, we would rotate the drawing axes
	// first by qTot, and then by qNew--we would apply mouse-dragging rotations
	// to already-rotated drawing axes.  Instead, we wish to apply the mouse-drag
	// rotations FIRST, before we apply rotations from all the previous dragging.
	//------------------------
	// IMPORTANT!  Both qTot and qNew are unit-length quaternions, but we store 
	// them with finite precision. While the product of two (EXACTLY) unit-length
	// quaternions will always be another unit-length quaternion, the qTmp length
	// may drift away from 1.0 if we repeat this quaternion multiply many times.
	// A non-unit-length quaternion won't work with our quaternion-to-matrix fcn.
	// Matrix4.prototype.setFromQuat().
//	qTmp.normalize();						// normalize to ensure we stay at length==1.0.
	qTot.copy(qTmp);
	// show the new quaternion qTot on our webpage in the <div> element 'QuatValue'
	document.getElementById('QuatValue').innerHTML= 
														 '\t X=' +qTot.x.toFixed(res)+
														'i\t Y=' +qTot.y.toFixed(res)+
														'j\t Z=' +qTot.z.toFixed(res)+
														'k\t W=' +qTot.w.toFixed(res)+
														'length='+qTot.length().toFixed(res);
};

function resetQuat() {
// Called when user presses 'Reset' button on our webpage, just below the 
// 'Current Quaternion' display.
  var res=5;
	qTot.clear();
	document.getElementById('QuatValue').innerHTML= 
														 '\t X=' +qTot.x.toFixed(res)+
														'i\t Y=' +qTot.y.toFixed(res)+
														'j\t Z=' +qTot.z.toFixed(res)+
														'k\t W=' +qTot.w.toFixed(res)+
														'length='+qTot.length().toFixed(res);
}

function animateKey(direction) {
  var now = Date.now();
  var gap = now - gs_last;
  	switch(direction) {
		case 0: 	
		cameraAngleY -= gap/10;
			break;
		case 1:
		cameraAngleY += gap/10;
  		break;
		case 2:
		cameraAngleX += gap/10;
  		break;
		case 3:
		cameraAngleX -= gap/10;
  		break;
		case 4:
		cameraYX -= gap/1000*Math.sin(Math.PI*cameraAngleY/180);
		cameraYY -= gap/1000*Math.cos(Math.PI*cameraAngleY/180);
  		break;
		case 5:
		cameraYX += gap/1000*Math.sin(Math.PI*cameraAngleY/180);
		cameraYY += gap/1000*Math.cos(Math.PI*cameraAngleY/180);
  		break;
		case 6:
		cameraX += gap/100;
  		break;
		case 7:
		cameraX -= gap/100;
  		break;
    default:
      break;
	}
	if(cameraAngleY > 360) cameraAngleY -= 360;
	else if(cameraAngleY < 0) cameraAngleY +=360;
	if(cameraAngleX > 360) cameraAngleX -= 360;
	else if(cameraAngleX < 0) cameraAngleX +=360;
}


	function drawResize() {
//==============================================================================
// Called when user re-sizes their browser window , because our HTML file
// contains:  <body onload="main()" onresize="winResize()">

	//Report our current browser-window contents:
																// http://www.w3schools.com/jsref/obj_window.asp

	
	//Make canvas fill the top 3/4 of our browser window:
	var xtraMargin = 16;    // keep a margin (otherwise, browser adds scroll-bars)
	canvas.width = innerWidth - xtraMargin;
	canvas.height = (innerHeight*3/4) - xtraMargin;
	// IMPORTANT!  Need a fresh drawing in the re-sized viewports.
}