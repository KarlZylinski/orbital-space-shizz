window.onload = function()
{
    var simulationState = setupSimulation()
    var rendererState = setupRenderer()
    setInterval(function() {
        var objects = simulate(simulationState)
        draw(rendererState, objects)
    }, 1000/30)
}

function setupSimulation()
{
    var state = {}
    return state
}



function simulate(state)
{
    var objects = []
    var test_object = {
        type: "triangle",
        size: 0.5
        // Add shader, position, color
    }
    objects.push(test_object)
    return objects
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
        console.error("Failed loading GL.")

    state.gl = gl
    var ext = initWebGLEW(gl)
    state.defaultShader = loadShaderProgram(gl, "shader-vs", "shader-fs")
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.enable(gl.DEPTH_TEST)
    return state
}

function draw(state, objects)
{
    var gl = state.gl
    var projection = mat4.create()
    var modelView = mat4.create()

    function createVertices(object)
    {
        var s = object.size
        switch(object.type)
        {
            case "triangle":
                return [
                    0, s, 0,
                    s/2, 0, 0,
                    -s/2, 0, 0
                ]
            default: console.error("Unknown object type.")
                break
        }
    }

    var allVertices = []

    for (var i = 0; i < objects.length; i++)
    {
        var object = objects[i]
        allVertices.push.apply(allVertices, createVertices(object))
    }

    var geometry = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(allVertices), gl.STATIC_DRAW)
    var itemSize = 3
    var numItems = 3
    gl.viewport(0, 0, state.resolutionX, state.resolutionY)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    mat4.perspective(45, state.resolutionX / state.resolutionY, 0.1, 100.0, projection)
    mat4.identity(modelView)
    // mat4.translate(modelView, [vec3])
    gl.vertexAttribPointer(shaderProgram.positionAttribute, itemSize, gl.FLOAT, false, 0, 0)
    gl.uniformMatrix4fv(shaderProgram.projectionUniform, false, projection)
    gl.uniformMatrix4fv(shaderProgram.modelViewUniform, false, modelView)
    gl.drawArrays(gl.TRIANGLES, 0, numItems)
    gl.deleteBuffer(geometry)
}

function getShader(gl, name) {
    var shaderScript = document.getElementById(name)

    if (!shaderScript)
        console.error("Failed loading shader width name " + name)

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
        console.error("Failed compiling shader: " + gl.getShaderInfoLog(shader))

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
        console.error("Could not init shaders")

    gl.useProgram(shaderProgram)
    shaderProgram.positionAttribute = gl.getAttribLocation(shaderProgram, "position")
    gl.enableVertexAttribArray(shaderProgram.positionAttribute)
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