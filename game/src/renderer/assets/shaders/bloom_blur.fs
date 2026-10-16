#version 100

precision highp float;

varying vec2 fragTexCoord;
varying vec4 fragColor;

uniform sampler2D texture0;
uniform vec2 texelSize;
uniform vec2 direction;

void main()
{
    vec3 result = texture2D(
        texture0, fragTexCoord
    ).rgb * 0.227027;

    result += texture2D(
        texture0,
        fragTexCoord + direction * texelSize * 1.384615
    ).rgb * 0.316216;

    result += texture2D(
        texture0,
        fragTexCoord - direction * texelSize * 1.384615
    ).rgb * 0.316216;

    result += texture2D(
        texture0,
        fragTexCoord + direction * texelSize * 3.230769
    ).rgb * 0.070270;

    result += texture2D(
        texture0,
        fragTexCoord - direction * texelSize * 3.230769
    ).rgb * 0.070270;

    gl_FragColor = vec4(result, 1.0);
}
