#version 100

precision highp float;

varying vec2 fragTexCoord;
varying vec4 fragColor;

uniform sampler2D texture0;
uniform float threshold;

void main()
{
    vec3 color = texture2D(texture0, fragTexCoord).rgb;

    // Approximate perceived brightness.
    float brightness = dot(
        color,
        vec3(0.2126, 0.7152, 0.0722)
    );

    float contribution = max(brightness - threshold, 0.0);

    // Preserve the original color, scaled by its brightness.
    vec3 bloom = color * contribution
        / max(brightness, 0.0001);

    gl_FragColor = vec4(bloom, 1.0);
}
