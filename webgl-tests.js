var GEOMETRY_SIZE = 9
var SUN_POS = [149600000, 0, 0]

window.onload = function()
{
    var simulationState = setupSimulation()
    var rendererState = setupRenderer()
    var startTime = new Date()
    var timeLastFrame = startTime
    var interval = setInterval(function() {
        var currentTime = new Date()
        var dt = (currentTime - timeLastFrame) / 1000.0
        var timeSinceStart = (currentTime - startTime) / 1000.0
        var timeLastFrame = currentTime

        if (dt === 0.0)
            dt = 0.001

        try
        {
            var objects = simulate(simulationState, timeSinceStart, dt)
            var geometry = createGeometry(objects)
            draw(rendererState, geometry)
        }
        catch(e)
        {
            clearInterval(interval)
        }

    }, 1000/30)
}

function setupSimulation()
{
    var state = {}
    return state
}

function simulate(state, t, dt)
{
    var objects = []

    var testTriangle = {
        type: "triangle",
        size: 0.5,
        position: [Math.cos(t), Math.sin(t), -5.0],
        color: [1, 0.7, 0],
        rotation: quat.rotateZ(quat.create(), quat.create(), t*3),
        shader: "default"
    }

    var testSphere = {
        type: "sphere",
        size: 2.0,
        position: [0, 0, -5.0],
        color: [1, 0.7, 0],
        rotation: quat.rotateY(quat.create(), quat.create(), t),
        shader: "default"
    }

    //objects.push(testTriangle)
    objects.push(testSphere)
    return objects
}

function createSphere(radius)
{
    var vertices = []
    var normals = []
    var latitudeBands = longitudeBands = 10 + radius * 10

    function getCoords(latNumber, longNumber)
    {
        var theta = latNumber * Math.PI / latitudeBands;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        var phi = longNumber * 2 * Math.PI / longitudeBands;
        var sinPhi = Math.sin(phi);
        var cosPhi = Math.cos(phi);

        var x = cosPhi * sinTheta;
        var y = cosTheta;
        var z = sinPhi * sinTheta;

        return { x: x, y: y, z: z };
    }

    function createSphereVertex(latNumber, longNumber)
    {
        var coords1 = getCoords(latNumber, longNumber)
        var coords2 = getCoords(latNumber + 1, longNumber)
        var coords3 = getCoords(latNumber, longNumber + 1)
        var coords4 = getCoords(latNumber + 1, longNumber)
        var coords5 = getCoords(latNumber + 1, longNumber + 1)
        var coords6 = getCoords(latNumber, longNumber + 1)

        vertices.push([coords1.x * radius, coords1.y * radius, coords1.z * radius])
        vertices.push([coords2.x * radius, coords2.y * radius, coords2.z * radius])
        vertices.push([coords3.x * radius, coords3.y * radius, coords3.z * radius])
        vertices.push([coords4.x * radius, coords4.y * radius, coords4.z * radius])
        vertices.push([coords5.x * radius, coords5.y * radius, coords5.z * radius])
        vertices.push([coords6.x * radius, coords6.y * radius, coords6.z * radius])

        normals.push([coords1.x, coords1.y, coords1.z])
        normals.push([coords2.x, coords2.y, coords2.z])
        normals.push([coords3.x, coords3.y, coords3.z])
        normals.push([coords4.x, coords4.y, coords4.z])
        normals.push([coords5.x, coords5.y, coords5.z])
        normals.push([coords6.x, coords6.y, coords6.z])
    }

    for (var latNumber = 0; latNumber <= latitudeBands; latNumber++)
    {
        for (var longNumber = 0; longNumber <= longitudeBands; longNumber++)
        {
            createSphereVertex(latNumber, longNumber)
        }
    }

    return {
        vertices: vertices,
        normals: normals
    }
}

function createGeometry(objects)
{
    function createVertices(object)
    {
        var s = object.size
        switch(object.type)
        {
            case "triangle":
                return {
                    vertices: [
                            [0, s/2, 0,],
                            [s/2, 0, 0],
                            [-s/2, 0, 0]
                        ],
                    normals: [
                            [0, 0, 1],
                            [0, 0, 1],
                            [0, 0, 1]
                        ]
                    }

            case "sphere":
                return createSphere(s)

            default: console.assert("Unknown object type.")
                break
        }
    }

    function transformVertices(geometry, position, rotation, color)
    {
        var transformedVertices = []

        for (var i = 0; i < geometry.vertices.length; i++)
        {
            var vertex = geometry.vertices[i]
            var normal = geometry.normals[i]
            var rotatedVertices = vec3.transformQuat(vec3.create(), vertex, rotation)
            var translatedVertices = vec3.add(vec3.create(), rotatedVertices, position)
            transformedVertices.push.apply(transformedVertices, translatedVertices)
            transformedVertices.push.apply(transformedVertices, vec3.transformQuat(vec3.create(), normal, rotation))
            transformedVertices.push.apply(transformedVertices, color)
        }

        return transformedVertices
    }

    var geometry = []
    
    for (var i = 0; i < objects.length; i++)
    {
        var object = objects[i]
        var vertices = createVertices(object)
        var data = transformVertices(vertices, object.position, object.rotation, object.color)

        var geometryObject = {
            data: data,
            shader: object.shader
        }

        geometry.push(geometryObject)
    }

    return geometry
}

function setupRenderer()
{
    var state = {}
    var canvas = document.createElement("canvas")
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    document.body.appendChild(canvas)
    var gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("experimental-webgl"))
    state.resolutionX = canvas.width
    state.resolutionY = canvas.height

    if (!gl)
        console.assert("Failed loading GL.")

    state.gl = gl
    var ext = initWebGLEW(gl)
    state.shaders = {}
    state.shaders.default = loadShaderProgram(gl, "default-vs", "default-fs")
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.enable(gl.DEPTH_TEST)
    return state
}

function draw(state, geometry)
{
    if (geometry.length == 0)
        console.assert("Nothing to render.")

    var sortedGeomtry = geometry.sort(function(a, b) {
        return a.shader < b.shader
    })

    var gl = state.gl
    gl.viewport(0, 0, state.resolutionX, state.resolutionY)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    var projection = mat4.create()
    mat4.perspective(projection, 45, state.resolutionX / state.resolutionY, 0.1, 100.0)

    function drawBatch(shaderName, vertices)
    {
        var geometryBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, geometryBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
        var model = mat4.create()
        mat4.identity(model)
        var view = mat4.create()
        var modelView = view * model
        var shader = state.shaders[shaderName]
        gl.useProgram(shader)
        gl.enableVertexAttribArray(shader.positionAttribute)
        gl.vertexAttribPointer(shader.positionAttribute, 3, gl.FLOAT, false, GEOMETRY_SIZE * 4, 0)
        gl.enableVertexAttribArray(shader.normalAttribute)
        gl.vertexAttribPointer(shader.normalAttribute, 3, gl.FLOAT, false, GEOMETRY_SIZE * 4, 3 * 4)
        gl.enableVertexAttribArray(shader.colorAttribute)
        gl.vertexAttribPointer(shader.colorAttribute, 3, gl.FLOAT, false, GEOMETRY_SIZE * 4, 6 * 4)
        gl.uniformMatrix4fv(shader.projectionUniform, false, projection)
        gl.uniformMatrix4fv(shader.modelViewUniform, false, model)
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / GEOMETRY_SIZE)
        gl.deleteBuffer(geometryBuffer)
    }

    var currentBatch = []
    var currentShader = sortedGeomtry[0].shader

    for (var i = 0; i < sortedGeomtry.length; i++)
    {
        var currentGeomtry = sortedGeomtry[i]

        if (currentGeomtry.shader != currentShader)
        {
            drawBatch(currentShader, currentBatch)
            currentShader = currentGeomtry.shader
            currentBatch = []
        }

        currentBatch.push.apply(currentBatch, currentGeomtry.data)
    }

    // Draw last batch.
    drawBatch(currentShader, currentBatch)
}

function getShader(gl, name) {
    var shaderScript = document.getElementById(name)

    if (!shaderScript)
        console.assert("Failed loading shader width name " + name)

    var str = ""
    var k = shaderScript.firstChild

    while (k) {
        if (k.nodeType == 3)
            str += k.textContent

        k = k.nextSibling
    }

    var typeMapping = {
        "x-shader/x-vertex": gl.VERTEX_SHADER,
        "x-shader/x-fragment": gl.FRAGMENT_SHADER
    }

    var shader = gl.createShader(typeMapping[shaderScript.type])
    gl.shaderSource(shader, str)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        console.assert("Failed compiling shader: " + gl.getShaderInfoLog(shader))

    return shader
}

function loadShaderProgram(gl, vertexShaderName, fragmentShaderName) {
    var vertexShader = getShader(gl, vertexShaderName)
    var fragmentShader = getShader(gl, fragmentShaderName)

    shaderProgram = gl.createProgram()
    gl.attachShader(shaderProgram, vertexShader)
    gl.attachShader(shaderProgram, fragmentShader)
    gl.linkProgram(shaderProgram)

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS))
        console.assert("Could not init shaders")

    shaderProgram.positionAttribute = gl.getAttribLocation(shaderProgram, "position")
    shaderProgram.normalAttribute = gl.getAttribLocation(shaderProgram, "normal")
    shaderProgram.colorAttribute = gl.getAttribLocation(shaderProgram, "color")
    shaderProgram.projectionUniform = gl.getUniformLocation(shaderProgram, "projection")
    shaderProgram.modelViewUniform = gl.getUniformLocation(shaderProgram, "modelView")
    return shaderProgram
}

var webGlewStruct = new WeakMap()

function baseName(extName) {
    return extName.replace(/^[A-Z]+_/, '')
}

function initWebGLEW(gl) {
    var struct = webGlewStruct.get(gl)

    if(struct)
        return struct

    var extensions = {}
    var supported = gl.getSupportedExtensions()

    for(var i = 0; i < supported.length; ++i)
    {
        var extName = supported[i]
        
        //Skip MOZ_ extensions
        if(extName.indexOf('MOZ_') === 0)
          continue
        
        var ext = gl.getExtension(supported[i])

        if(!ext)
          continue
        
        while(true) {
          extensions[extName] = ext
          var base = baseName(extName)

          if(base === extName)
            break

          extName = base
        }
    }

    webGlewStruct.set(gl, extensions)
    return extensions
}