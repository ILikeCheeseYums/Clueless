/**
 * A shared AudioContext instance for the application.
 * Kept global to the module to prevent creating multiple contexts (which browsers restrict).
 */
let audioCtx = null;

/**
 * Synthesizes a spatial footstep/movement sound effect using the Web Audio API.
 * The tone and frequency sweep differ depending on whether the user is moving forward or backward.
 * 
 * @param {string} dir - The direction of movement ("forward", "backward", "right", "left")
 */
export function playAudio(dir = "forward") {
  try {
    // Initialize AudioContext on first user interaction if it hasn't been created yet
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Browsers suspend audio contexts until the user interacts with the page
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // Determine tone based on direction
    const isFwd = dir === "forward" || dir === "right";
    
    // Setup Sine wave oscillator for a smooth, low-end "whoosh" or "step" sound
    osc.type = "sine";
    
    // Set initial frequency and pitch-bend (sweep) over 0.22 seconds
    osc.frequency.setValueAtTime(isFwd ? 250 : 150, now);
    osc.frequency.exponentialRampToValueAtTime(isFwd ? 130 : 260, now + 0.22);
    
    // Shape the volume envelope: start at 18% volume, fade out exponentially
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    // Connect audio routing graph: Oscillator -> Gain Envelope -> Speakers
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    
    // Play the sound immediately and stop it after 0.25s to free resources
    osc.start(now); 
    osc.stop(now + 0.25);
  } catch (_) {
    // Fail silently (e.g., if the browser strictly blocks audio before user interaction)
  }
}
