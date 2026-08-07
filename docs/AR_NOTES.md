# Augmented reality — why it's out, and what the cheapest real path would cost

**Status: decision note. AR is a hard constraint (see `CLAUDE.md` → Hard constraints,
and `SAFETY.md`). This document records the reasoning so "why not AR?" and "what would
it actually take?" are captured, not re-litigated from memory each time.**

The constraint today: *No AR, no persistent anchors, no WebXR. Echoes are
map-anchored.* Adding AR would **reverse a hard constraint** — it is a deliberate
product decision, not something to route around or bolt on. Treat any "let's add AR"
as a decision to make explicitly, per the working agreement.

---

## AR is a ladder, not one feature

Most of the difficulty conversation collapses once you see that "AR" spans four very
different levels. A lot of shipped "AR features" are actually level 1.

| Level | What it does | How it works | Cost |
|-------|--------------|--------------|------|
| **1. Sensor overlay** ("heads-up") | Floats labels/markers over the live camera based on where you point | Camera feed + compass/gyro/GPS. **No scene understanding** — position comes from heading + location alone | Low |
| **2. Marker-based** | Content glued to a QR/image/fiducial target | Camera detects a known target, renders relative to it | Low–med |
| **3. Markerless / SLAM** ("real" AR) | Place a virtual object that *sticks* to the floor as you walk around | Visual-inertial odometry (camera + IMU fused → 6DoF pose), plane detection, hit-testing, anchors | Med–high |
| **4. Persistent / geospatial** | An object pinned to a real place, shared across users and sessions | Level 3 **plus** a localization backend (VPS / cloud anchors) matching a pre-scanned 3D map of the world | High |

The jump that matters is **1 → 3**. Level 1 just trusts the compass; level 3 genuinely
tracks the phone in 3D space; level 4 needs server-side world localization.

---

## What level 3 does under the hood

A markerless AR session runs this loop ~60×/second:

1. **Pose (VIO)** — fuse camera frames with the IMU. IMU is fast but drifts; camera is
   slow but absolute; fusing them gives stable 6DoF tracking.
2. **Mapping** — track feature points → sparse point cloud → detect **planes** (floor,
   table, wall).
3. **Hit-test** — cast a ray from a screen tap into detected geometry to find the
   real-world point the user touched.
4. **Anchor** — a stable reference frame pinned to that point; content stays put as the
   user moves.
5. **Render** — draw 3D content each frame from the current camera pose.
6. **Realism extras (optional)** — light estimation, depth/occlusion, people occlusion,
   semantic segmentation.

Level 4 swaps the session-local anchor for a **Visual Positioning System** (Niantic
Lightship, Google ARCore Geospatial, Immersal, 8th Wall) that localizes against a global
3D map, so the anchor is the *same real place* for everyone.

---

## Which surface you'd build on

- **Native** — ARKit (iOS), ARCore (Android), or **Unity + AR Foundation**
  (cross-platform, the usual choice for games). Mature and fully capable.
- **Web (WebXR)** — the open standard. Works in **Chrome on Android**. **iOS Safari
  does not support WebXR AR**, with no sign of changing. So pure WebXR reaches ~half the
  users and skips every iPhone.
- **Web via commercial SDK** — **8th Wall** (Niantic), Zappar, etc. run their own SLAM
  in WebAssembly, delivering markerless WebAR that works on iOS Safari too. This is how
  most "no-install" cross-platform AR ships. Paid platform.
- **Simple object viewing** — `<model-viewer>` + AR Quick Look (iOS) / Scene Viewer
  (Android): "view this 3D model in your room." A viewer, not an interactive experience.

---

## Practical gotchas

- **iOS Safari + WebXR is the single biggest blocker** and shapes every web-AR decision.
- **GPS/compass AR (level 1) is low precision** — heading drifts, GPS ±5–15 m. Fine for
  "point toward that landmark," useless for "place a coin exactly on this bench."
- **Persistent/shared AR needs a backend** (VPS/cloud anchors). Not a client-only feature.
- **Battery, thermal, lighting** — continuous camera + tracking is heavy and fails in
  low light.
- **Safety/UX** — people staring through a camera while walking. Needs *more* of the
  "stay aware of your surroundings" guardrail we already ship, not less.

---

## Why the constraint is right for Aura

Not just caution — the constraint removes a genuine architectural trap:

1. **PWA + iPhone Safari is exactly where WebXR AR doesn't exist.** Real (level 3) web AR
   would force either a **paid SDK** (8th Wall) *or* a **native wrapper** — and the
   native wrapper is *also* a hard constraint. AR quietly drags two constraints down at
   once.
2. **Echoes are deliberately map-anchored, not world-anchored**, which sidesteps the
   entire level-4 VPS backend. Persistent shared anchors are ongoing infrastructure, not
   a bolt-on.
3. **The pilot tests loop retention.** AR is a well-known novelty spike that fades; it
   would not move the actual hypothesis, and would add camera-permission friction and a
   new privacy surface to the funnel we're trying to measure cleanly.

---

## If AR were ever green-lit — the honest cost

In rough order of increasing cost/commitment:

- **Level 1, inside the PWA rules** — a `getUserMedia` camera view with
  `DeviceOrientation`-driven markers showing bearing/distance to a nearby Fracture ("it's
  that way"). Buildable in a browser. *Still brushes the constraint*, iOS makes the
  orientation-permission flow fiddly, and precision is poor. This is the only tier that
  fits PWA-only.
- **Level 3 reaching iPhones** — a commercial WebAR SDK (8th Wall or similar). New paid
  dependency, new bundle weight, new privacy/permission surface.
- **Level 3 the "proper" way** — a native or Unity app. Reverses the PWA-only constraint
  outright.
- **Level 4 (Echoes pinned to real corners for everyone)** — all of the above **plus** a
  VPS/cloud-anchor backend and a world-scanning step. This is a platform, not a feature.

**Recommendation:** keep AR out for v0 and well beyond. Revisit only if (a) retention is
proven, (b) there's a concrete mechanic AR makes materially better than a map does — not
"AR because AR" — and (c) you've accepted the paid-SDK-or-native cost with eyes open. If
that day comes, the level-1 compass overlay is the only experiment worth running first,
because it's cheap and tells you whether players even want to hold the phone up.
