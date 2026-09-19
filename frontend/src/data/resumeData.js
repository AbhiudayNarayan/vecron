export const resumeData = {
  name: 'Abhiuday Narayan',
  contacts: [
    { label: '+91-6201220282', href: 'tel:+916201220282' },
    { label: 'narayanabhiuday@gmail.com', href: 'mailto:narayanabhiuday@gmail.com' },
    { label: 'https://www.linkedin.com/in/abhiuday-narayan-a44153327/', href: 'https://www.linkedin.com/in/abhiuday-narayan-a44153327/' },
    { label: 'github.com/AbhiudayNarayan', href: 'https://github.com/AbhiudayNarayan' },
    { label: 'leetcode.com/u/Abhiuday_Narayan', href: 'https://leetcode.com/u/Abhiuday_Narayan' },
    { label: 'wandb.ai/abhi_nits', href: 'https://wandb.ai/abhi_nits' },
  ],
  education: { institution: 'National Institute of Technology, Silchar', location: 'Silchar, Assam', qualification: 'B.Tech in Electrical Engineering', detail: 'CGPA: 7.83/10', graduation: 'Expected Graduation: 2028', secondary: 'Class XII: 91.8%' },
  skills: [
    { label: 'Languages', items: 'Python, C++, C, SQL, JavaScript' },
    { label: 'Backend & DevOps', items: 'FastAPI (Async), Async SQLAlchemy, MySQL, REST APIs, Ubuntu Server, GitHub CI/CD, Cloudflare Tunnels, JWT Authentication' },
    { label: 'Data Science & ML', items: 'Pandas, NumPy, Scikit-learn, PyTorch, LangChain, LangGraph, OpenCV' },
    { label: 'Edge AI & Hardware', items: 'Raspberry Pi 4, ArduPilot, MAVLink, LoRa, Fusion 360, ONNX Runtime Web, NCNN, TensorFlow Lite, Weights & Biases' },
    { label: 'Frontend', items: 'React, Vite, Tailwind CSS, WebGL, Browser WASM' },
  ],
  experience: [{ title: 'Machine Learning Research Intern – Drone Lab', date: 'Feb 2026 – Aug 2026', organization: 'National Institute of Technology, Silchar', location: 'Silchar, Assam', bullets: ['Designed a domain-adapted YOLO model with custom CBAM (Channel and Spatial Attention) modules to optimize an early-warning aerial forest fire detection system, prioritizing high recall to minimize catastrophic false negatives.', 'Diagnosed and resolved a complete training collapse (mAP dropping to 0) caused by gradient explosion from randomly initialized attention layers; implemented a two-stage warm-up strategy by freezing the COCO-pretrained backbone for 15 epochs to stabilize fine-tuning.', 'Deployed the lightweight model on a Raspberry Pi 4 (8GB) utilizing the NCNN framework for ARM-based hardware optimization; deliberately capped inference at 6 FPS to preserve 50% CPU overhead for concurrent telemetry and flight control tasks.'] }],
  projects: [
    { title: 'NIDAR – Edge AI Search-and-Rescue Drone System', technologies: 'YOLO, NCNN FP16, Raspberry Pi 4, Picamera2, OpenCV, ArduPilot, MAVLink, LoRa', bullets: ['Developed a Raspberry Pi-based edge vision pipeline for human detection using NCNN FP16 inference, capturing real-time video via Picamera2 and OpenCV.', 'Built a MAVLink telemetry interface to connect with ArduPilot, dynamically logging visual YOLO detections alongside the drone’s active GPS position, altitude, and attitude data.', 'Architected a dual-band communication system utilizing LoRa for low-latency telemetry and emergency compressed-image fallback, alongside long-range Wi-Fi for primary video transmission.'] },
    { title: 'Edgenix.dev – Client-Side ML Inference Platform', technologies: 'React, Vite, FastAPI, MySQL, ONNX Runtime Web, WebGL, WebAssembly, GitHub CI/CD', bullets: ['Architected a client-side inference platform hosting 7 lightweight YOLO Nano models (including fire, human, and pothole detection) using ONNX Runtime Web and WebGL, offloading compute to user devices to eliminate server-side GPU costs.', 'Deployed an asynchronous FastAPI backend on a self-managed Ubuntu Server homelab, engineering a GitHub CI/CD pipeline for automated updates and utilizing Cloudflare Tunnels to securely expose the local server through restrictive university network firewalls.', 'Implemented secure user authentication and model distribution using MySQL and JWTs, managing state and UI rendering via React and Vite.'] },
  ],
  achievements: ['2nd Place – Robotron Heavyweight Robowar (15 teams): Designed and fabricated a heavyweight combat robot using Fusion 360.', 'Top 7 among 150+ teams – Neurathon ’26: Developed a multi-agent event logistics platform utilizing LangChain, LangGraph, and the OpenAI API for automated task coordination.', '1st Place – Electra Society Hackathon: Conceptualized and pitched a comprehensive hardware/software disaster management platform.', 'Executive Member – N.E.R.D.S Robotics Club: Mentor junior members in robotics fundamentals and organize technical workshops.'],
}
