var GEOMETRY_SIZE = 9
var SUN_POS = [-1000000, 0, 1000000]

window.onload = function()
{
    var simulationState = simulation.setup()
    var rendererState = renderer.setup()
    var inputState = input.setup()
    var startTime = new Date()
    var timeLastFrame = null

    var interval = setInterval(function() {
        var currentTime = new Date()

        var dt = timeLastFrame == null 
            ? 1
            : (currentTime - timeLastFrame)

        var timeSinceStart = (currentTime - startTime) / 1000.0
        var timeLastFrame = currentTime

        if (dt === 0)
            dt = 1

        dt = dt / 1000.0

        try
        {
            var inputThisFrame = clone(inputState)
            input.reset(inputState)
            simulation.simulate(simulationState, inputThisFrame, timeSinceStart, dt)
            renderer.createAddedObjects(rendererState, simulationState.addedObjects)
            renderer.destroyRemovedObjects(rendererState, simulationState.removedObjects)
            simulationState.addedObjects = []
            simulationState.removedObjects = []
            renderer.draw(rendererState, simulationState.camera.view)
        }
        catch(e)
        {
            console.error(e)
            clearInterval(interval)
        }
    }, 1000/30)
}

function clone(obj) {
    if (null == obj || "object" != typeof obj)
        return obj

    var copy = obj.constructor()

    for (var attr in obj)
    {
        if (obj.hasOwnProperty(attr))
            copy[attr] = obj[attr]
    }
    
    return copy
}

var input = {
    setup: function()
    {
        var state = {
            mouseDeltaX: 0,
            mouseDeltaY: 0
        }

        document.addEventListener("mousemove", function(e) {
            state.mouseDeltaX += e.movementX
            state.mouseDeltaY += e.movementY
        })

        return state
    },

    reset: function(state)
    {
        state.mouseDeltaX = 0
        state.mouseDeltaY = 0
    }
}

var simulation = {
    setup: function()
    {
        var state = {}
        state.world = []
        state.addedObjects = []
        state.removedObjects = []

        var planetSize = 6371
        var planet = entity.spawn(state, "sphere", planetSize, function(obj, dt, t) {
            entity.rotateZ(obj, dt)
        })

        planet.color = [0.9, 0.1, 0.1]
        entity.translate(planet, [500, -2552, 12121])
        entity.rotateY(planet, -50)

        function getCoords(latNumber, longNumber)
        {
            var latitudeBands = longitudeBands = Math.min(100, 10 + planetSize)
            var theta = latNumber * Math.PI / latitudeBands
            var sinTheta = Math.sin(theta)
            var cosTheta = Math.cos(theta)

            var phi = longNumber * 2 * Math.PI / longitudeBands
            var sinPhi = Math.sin(phi)
            var cosPhi = Math.cos(phi)

            var x = cosPhi * sinTheta
            var y = cosTheta
            var z = sinPhi * sinTheta

            return [x, y, z]
        }


        var rocketSize = 0.08
        state.player = entity.spawn(state, "rocket", rocketSize, function(obj, dt, t) {
        })
        state.player.color = [0, 1, 0]
        entity.setParent(state.player, planet)

        var planetNormPos = getCoords(0, 0)
        var offset = vec3.scale(vec3.create(), planetNormPos, planetSize + 0.2)
        var base = entity.spawn(state, "box", 0.7)
        entity.setParent(base, planet)
        entity.translate(base, vec3.subtract(vec3.create(), offset, [0, 0.45, 0]))

        state.cameraOrbitEntity = entity.spawn(state, null, 0, function(obj, dt, t, input) {
            entity.rotateY(obj, -input.mouseDeltaX/500.0)
            entity.rotateX(obj, -input.mouseDeltaY/500.0)
        })
        entity.setParent(state.cameraOrbitEntity, state.player)

        state.camera = entity.spawn(state, null, 0, function(obj, dt, t, input) {
            obj.view = mat4.lookAt(obj.view,
                entity.worldPosition(obj),
                entity.worldPosition(obj.parent),
                vec3.subtract(vec3.create(), entity.worldPosition(obj), entity.worldPosition(planet)))
        })

        entity.translate(state.player, offset)

        state.camera.view = mat4.create()
        entity.setParent(state.camera, state.cameraOrbitEntity)
        entity.translate(state.camera, [0, 0, 1])

        return state
    },

    simulate: function(state, input, t, dt)
    {
        for (var i = 0; i < state.world.length; ++i)
        {
            var obj = state.world[i]

            if (obj.update)
                obj.update(obj, dt, t, input)
        }
    }
}

var entity = {
    spawn: function(simulationState, type, size, update)
    {
        var e = {
            type: type,
            size: size,
            children: [],
            position: vec3.create(),
            rotation: quat.create(),
            model: mat4.create(),
            color: [1, 1, 1],
            shader: "default",
            update: update
        }

        simulationState.world.push(e)
        simulationState.addedObjects.push(e)
        entity.calculateModel(e)
        return e
    },

    calculateModel: function(e)
    {
        function calculate(e)
        {
            var model = mat4.fromRotationTranslation(mat4.create(), e.rotation, e.position)
        
            if (e.parent)
            {
                var parentTransform = calculate(e.parent)
                return mat4.multiply(mat4.create(), parentTransform, model)
            }

            return model
        }

        e.model = calculate(e)

        for (var i = 0; i < e.children.length; ++i) {
            entity.calculateModel(e.children[i])
        }
    },

    worldPosition: function(e)
    {
        var model = e.model
        return [model[12], model[13], model[14]]
    },

    translate: function(e, vec)
    {
        vec3.add(e.position, e.position, vec)
        entity.calculateModel(e)
    },

    rotateX: function(e, rads)
    {
        quat.rotateX(e.rotation, e.rotation, rads)
        entity.calculateModel(e)
    },

    rotateY: function(e, rads)
    {
        quat.rotateY(e.rotation, e.rotation, rads)
        entity.calculateModel(e)
    },

    rotateZ: function(e, rads)
    {
        quat.rotateZ(e.rotation, e.rotation, rads)
        entity.calculateModel(e)
    },

    setParent: function(e, parent)
    {
        parent.children.push(e)
        e.parent = parent
        entity.calculateModel(e)
    }
}

var renderer = {
    createGeometry: function(state, object)
    {
        function createSphere(radius)
        {
            var vertices = []
            var normals = []
            var latitudeBands = longitudeBands = Math.min(100, 10 + radius)

            function getCoords(latNumber, longNumber)
            {
                var theta = latNumber * Math.PI / latitudeBands
                var sinTheta = Math.sin(theta)
                var cosTheta = Math.cos(theta)

                var phi = longNumber * 2 * Math.PI / longitudeBands
                var sinPhi = Math.sin(phi)
                var cosPhi = Math.cos(phi)

                var x = cosPhi * sinTheta
                var y = cosTheta
                var z = sinPhi * sinTheta

                return { x: x, y: y, z: z }
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
        
        function createVertices(object)
        {
            var s = object.size
            var rw = 3.5
            var tw = 4
            var h = s/2
            switch(object.type)
            {
                case "triangle":
                    return {
                        vertices: [
                                [0, s/2, 0],
                                [s/2, 0, 0],
                                [-s/2, 0, 0]
                            ],
                        normals: [
                                [0, 0, -1],
                                [0, 0, -1],
                                [0, 0, -1]
                            ]
                        }

                case "sphere":
                    return createSphere(s)

                case "box":
                    return {
                        vertices: [
                                // Back
                                [h, h, -h],
                                [h, 0, -h],
                                [-h, 0, -h],
                                [-h, 0, -h],
                                [-h, h, -h],
                                [h, h, -h],

                                // Front
                                [h, h, h],
                                [h, 0, h],
                                [-h, 0, h],
                                [-h, 0, h],
                                [-h, h, h],
                                [h, h, h],

                                 // Right
                                [h, h, h],
                                [h, 0, h],
                                [h, 0, -h],
                                [h, 0, -h],
                                [h, h, -h],
                                [h, h, h],

                                 // Left
                                [-h, h, h],
                                [-h, 0, h],
                                [-h, 0, -h],
                                [-h, 0, -h],
                                [-h, h, -h],
                                [-h, h, h],

                                 // Top
                                [-h, h, -h],
                                [h, h, -h],
                                [-h, h, h],
                                [h, h, -h],
                                [h, h, h],
                                [-h, h, h]
                            ],
                        normals: [
                                [0, 0, -1],
                                [0, 0, -1],
                                [0, 0, -1],
                                [0, 0, -1],
                                [0, 0, -1],
                                [0, 0, -1],
                                [0, 0, 1],
                                [0, 0, 1],
                                [0, 0, 1],
                                [0, 0, 1],
                                [0, 0, 1],
                                [0, 0, 1],
                                [1, 0, 0],
                                [1, 0, 0],
                                [1, 0, 0],
                                [1, 0, 0],
                                [1, 0, 0],
                                [1, 0, 0],
                                [-1, 0, 0],
                                [-1, 0, 0],
                                [-1, 0, 0],
                                [-1, 0, 0],
                                [-1, 0, 0],
                                [-1, 0, 0],
                                [0, 1, 0],
                                [0, 1, 0],
                                [0, 1, 0],
                                [0, 1, 0],
                                [0, 1, 0],
                                [0, 1, 0]
                            ]
                        }

                case "rocket":
                    return {
                        vertices: [
                            // Top front
                            [0, s/2, 0,],
                            [s/2, 0, s/2],
                            [-s/2, 0, s/2],

                            // Top right
                            [0, s/2, 0,],
                            [s/2, 0, -s/2],
                            [s/2, 0, s/2],

                            // Top back
                            [0, s/2, 0,],
                            [s/2, 0, -s/2],
                            [-s/2, 0, -s/2],

                            // Top left
                            [0, s/2, 0,],
                            [-s/2, 0, -s/2],
                            [-s/2, 0, s/2],

                            // Bottom
                            [-s/2, 0, s/2],
                            [s/2, 0, s/2],
                            [-s/2, 0, -s/2],
                            [s/2, 0, s/2],
                            [s/2, 0, -s/2],
                            [-s/2, 0, -s/2],

                            // Right side
                            [s/rw, 0, s/rw],
                            [s/rw, 0, -s/rw],
                            [s/rw, -s, -s/rw],
                            [s/rw, 0, s/rw],
                            [s/rw, -s, s/rw],
                            [s/rw, -s, -s/rw],

                            // Left side
                            [-s/rw, 0, s/rw],
                            [-s/rw, 0, -s/rw],
                            [-s/rw, -s, -s/rw],
                            [-s/rw, 0, s/rw],
                            [-s/rw, -s, s/rw],
                            [-s/rw, -s, -s/rw],

                            // Front side
                            [s/rw, 0, s/rw],
                            [-s/rw, 0, s/rw],
                            [-s/rw, -s, s/rw],
                            [s/rw, 0, s/rw],
                            [s/rw, -s, s/rw],
                            [-s/rw, -s, s/rw],

                            // Back side
                            [s/rw, 0, -s/rw],
                            [-s/rw, 0, -s/rw],
                            [-s/rw, -s, -s/rw],
                            [s/rw, 0, -s/rw],
                            [s/rw, -s, -s/rw],
                            [-s/rw, -s, -s/rw],

                            // Far bottom
                            [-s/rw, -s, s/rw],
                            [s/rw, -s, s/rw],
                            [-s/rw, -s, -s/rw],
                            [s/rw, -s, s/rw],
                            [s/rw, -s, -s/rw],
                            [-s/rw, -s, -s/rw],

                            // Thruster front
                            [0, -s+s/5, 0],
                            [s/tw, -s-s/rw, s/tw],
                            [-s/tw, -s-s/rw, s/tw],

                            // Thruster right
                            [0, -s+s/5, 0],
                            [s/tw, -s-s/rw, -s/tw],
                            [s/tw, -s-s/rw, s/tw],

                            // Thruster back
                            [0, -s+s/5, 0],
                            [s/tw, -s-s/rw, -s/tw],
                            [-s/tw, -s-s/rw, -s/tw],

                            // Thruster left
                            [0, -s+s/5, 0],
                            [-s/tw, -s-s/rw, -s/tw],
                            [-s/tw, -s-s/rw, s/tw]
                        ],
                    normals: [
                            [0, 0.5, -0.5],
                            [0, 0.5, -0.5], 
                            [0, 0.5, -0.5],
                            [0.5, 0.5, 0],
                            [0.5, 0.5, 0],
                            [0.5, 0.5, 0],
                            [0, 0.5, 0.5],
                            [0, 0.5, 0.5], 
                            [0, 0.5, 0.5],
                            [-0.5, 0.5, 0],
                            [-0.5, 0.5, 0],
                            [-0.5, 0.5, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [1.0, 0, 0],
                            [1.0, 0, 0],
                            [1.0, 0, 0],
                            [1.0, 0, 0],
                            [1.0, 0, 0],
                            [1.0, 0, 0],
                            [-1.0, 0, 0],
                            [-1.0, 0, 0],
                            [-1.0, 0, 0],
                            [-1.0, 0, 0],
                            [-1.0, 0, 0],
                            [-1.0, 0, 0],
                            [0, 0, 1.0],
                            [0, 0, 1.0],
                            [0, 0, 1.0],
                            [0, 0, 1.0],
                            [0, 0, 1.0],
                            [0, 0, 1.0],
                            [0, 0, -1.0],
                            [0, 0, -1.0],
                            [0, 0, -1.0],
                            [0, 0, -1.0],
                            [0, 0, -1.0],
                            [0, 0, -1.0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, -1.0, 0],
                            [0, 0.5, -0.5],
                            [0, 0.5, -0.5], 
                            [0, 0.5, -0.5],
                            [0.5, 0.5, 0],
                            [0.5, 0.5, 0],
                            [0.5, 0.5, 0],
                            [0, 0.5, 0.5],
                            [0, 0.5, 0.5], 
                            [0, 0.5, 0.5],
                            [-0.5, 0.5, 0],
                            [-0.5, 0.5, 0],
                            [-0.5, 0.5, 0]
                        ]
                    }

                default: console.error("Unknown object type.")
                    break
            }
        }

        function packVertices(geometry, color)
        {
            var transformedVertices = []

            for (var i = 0; i < geometry.vertices.length; i++)
            {
                transformedVertices.push.apply(transformedVertices, geometry.vertices[i])
                transformedVertices.push.apply(transformedVertices, geometry.normals[i])
                transformedVertices.push.apply(transformedVertices, color)
            }

            return transformedVertices
        }

        if (object.type == null)
            return null

        var vertices = createVertices(object)
        var transformedVertices = packVertices(vertices, object.color)
        var gl = state.gl
        var handle = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, handle)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(transformedVertices), gl.STATIC_DRAW)

        return {
            handle: handle,
            size: transformedVertices.length / GEOMETRY_SIZE
        }
    },

    setup: function()
    {
        var state = {}
        var canvas = document.createElement("canvas")
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        document.body.appendChild(canvas)
        var gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("experimental-webgl"))
        state.resolutionX = canvas.width
        state.resolutionY = canvas.height
        state.world = []
        console.assert(gl, "Failed loading GL.")
        state.gl = gl
        var ext = initWebGLEW(gl)
        state.shaders = {}
        state.shaders.default = renderer.loadShaderProgram(gl, "default-vs", "default-fs")
        gl.clearColor(0.0, 0.0, 0.0, 1.0)
        gl.enable(gl.DEPTH_TEST)
        return state
    },

    createAddedObjects: function(state, addedObjects)
    {
        for (var i = 0; i < addedObjects.length; ++i)
        {
            var obj = addedObjects[i]

            if (!obj.type)
                return

            obj.geometry = renderer.createGeometry(state, obj)
            state.world.push(obj)
        }
    },

    destroyRemovedObjects: function(state, removedObjects)
    {
        for (var i = 0; i < removedObjects.length; ++i)
        {
            var obj = removedObjects[i]

            if (!obj.type)
                return

            gl.deleteBuffer(obj.geometry.handle)
        }
    },

    draw: function(state, view)
    {
        var gl = state.gl
        gl.viewport(0, 0, state.resolutionX, state.resolutionY)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        var projection = mat4.create()
        mat4.perspective(projection, 45, state.resolutionX / state.resolutionY, 0.5, 1000.0)

        function drawObject(object)
        {
            var model = object.model
            var modelInverseTranspose = mat4.clone(model)
            mat4.invert(modelInverseTranspose, modelInverseTranspose)
            var modelView = mat4.create()
            mat4.multiply(modelView, view, model)
            var shader = state.shaders[object.shader]
            gl.bindBuffer(gl.ARRAY_BUFFER, object.geometry.handle)
            gl.useProgram(shader)
            gl.enableVertexAttribArray(shader.positionAttribute)
            gl.vertexAttribPointer(shader.positionAttribute, 3, gl.FLOAT, false, GEOMETRY_SIZE * 4, 0)
            gl.enableVertexAttribArray(shader.normalAttribute)
            gl.vertexAttribPointer(shader.normalAttribute, 3, gl.FLOAT, false, GEOMETRY_SIZE * 4, 3 * 4)
            gl.enableVertexAttribArray(shader.colorAttribute)
            gl.vertexAttribPointer(shader.colorAttribute, 3, gl.FLOAT, false, GEOMETRY_SIZE * 4, 6 * 4)
            gl.uniform3fv(shader.sunPositionUniform, SUN_POS)
            gl.uniformMatrix4fv(shader.modelInverseTransposeUniform, false, modelInverseTranspose)
            gl.uniformMatrix4fv(shader.projectionUniform, false, projection)
            gl.uniformMatrix4fv(shader.modelUniform, false, model)
            gl.uniformMatrix4fv(shader.modelViewUniform, false, modelView)
            gl.drawArrays(gl.TRIANGLES, 0, object.geometry.size)
        }

        for (var i = 0; i < state.world.length; i++)
            drawObject(state.world[i])
    },

    loadShaderProgram: function(gl, vertexShaderName, fragmentShaderName)
    {
        function getShader(gl, name)
        {
            var shaderScript = document.getElementById(name)
            console.assert(shaderScript, "Failed loading shader width name " + name)

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
            console.assert(gl.getShaderParameter(shader, gl.COMPILE_STATUS), "Failed compiling shader: " + gl.getShaderInfoLog(shader))
            return shader
        }

        var vertexShader = getShader(gl, vertexShaderName)
        var fragmentShader = getShader(gl, fragmentShaderName)
        shaderProgram = gl.createProgram()
        gl.attachShader(shaderProgram, vertexShader)
        gl.attachShader(shaderProgram, fragmentShader)
        gl.linkProgram(shaderProgram)
        console.assert(gl.getProgramParameter(shaderProgram, gl.LINK_STATUS), "Could not init shaders")
        shaderProgram.positionAttribute = gl.getAttribLocation(shaderProgram, "position")
        shaderProgram.normalAttribute = gl.getAttribLocation(shaderProgram, "normal")
        shaderProgram.colorAttribute = gl.getAttribLocation(shaderProgram, "color")
        shaderProgram.sunPositionUniform = gl.getUniformLocation(shaderProgram, "sunPosition")
        shaderProgram.modelInverseTransposeUniform = gl.getUniformLocation(shaderProgram, "modelInverseTranspose")
        shaderProgram.projectionUniform = gl.getUniformLocation(shaderProgram, "projection")
        shaderProgram.modelUniform = gl.getUniformLocation(shaderProgram, "model")
        shaderProgram.modelViewUniform = gl.getUniformLocation(shaderProgram, "modelView")
        return shaderProgram
    }
}

var webGlewStruct = new WeakMap()

function initWebGLEW(gl) {

    function baseName(extName) {
        return extName.replace(/^[A-Z]+_/, '')
    }

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
