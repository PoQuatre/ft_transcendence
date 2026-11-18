#version 100

precision highp float;

varying vec2 fragTexCoord;
varying vec2 fragPosition;
varying vec4 fragColor;

uniform vec2 resolution;
uniform vec2 light_position;
uniform float light_radius;
uniform float light_intensity;
uniform vec4 light_color;
uniform sampler2D shadowMap;

void main() {
	// Ambient illumination.
    // Prevents areas without lights from being completely black.

    vec3 color = vec3(0);

    // UV coordinates -> pixel coordinates.
    // Assumes light positions are supplied in render-target pixel space.
	vec2 position = vec2(fragPosition.x, fragPosition.y);

	vec2 lightPosition = light_position.xy;

	float radius = light_radius;
	float intensity = light_intensity;

	float distanceToLight = distance(position, lightPosition);

	// Normalize distance within the light's radius.
	float normalizedDistance = distanceToLight / radius;

	// Smooth radial falloff.
	float attenuation = 1.0 - smoothstep(0.0, 1.0, normalizedDistance);

	// Apply intensity.
	attenuation *= intensity;

	// Add colored light contribution.
	vec3 lightColor = light_color.rgb;

	vec2 shadowUV = gl_FragCoord.xy / resolution;
	float shadowVisibility = texture2D(shadowMap, shadowUV).r;

	color += lightColor * attenuation * shadowVisibility;

    // Clamp to avoid excessive brightness.
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
}
