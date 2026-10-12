#version 100

precision highp float;

varying vec2 fragTexCoord;
varying vec4 fragColor;

uniform sampler2D texture0;
uniform sampler2D bloomTexture;
uniform float bloomIntensity;

void main()
{
    vec3 scene = texture2D(
        texture0, fragTexCoord
    ).rgb;

    vec3 bloom = texture2D(
        bloomTexture, fragTexCoord
    ).rgb;

    gl_FragColor = vec4(
        scene + bloom * bloomIntensity,
        1.0
    );
}
