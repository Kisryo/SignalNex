const API_KEY = "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";

export async function generateClientSuggestions(client, notes = "") {
  try {
    const prompt = `
      You are an expert financial advisor assistant. 
      Analyze the following client:
      Name: ${client.name}
      Segment: ${client.segment}
      Age: ${client.age}
      Occupation: ${client.occupation}
      Assets: ${client.assets}
      Needs: ${client.needs.join(", ")}
      Recent Notes: ${notes}

      Suggest exactly 3 strategic "Next Best Actions" for the financial advisor to take with this client. 
      Return the response ONLY as a valid JSON array of objects with the following keys:
      - "id": a unique string (e.g. "ai-action-1")
      - "title": the action to take
      - "priority": "High", "Medium", or "Low"
      - "owner": "Advisor"
      - "reason": a short explanation of why this action is recommended
      - "blocked": false

      Do not include markdown formatting like \`\`\`json.
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    let actions = [];
    try {
      const cleanedContent = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed = JSON.parse(cleanedContent);
      if (parsed && !Array.isArray(parsed)) {
        const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
        if (possibleArray) parsed = possibleArray;
        else parsed = [parsed];
      }
      actions = Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      console.error("Failed to parse actions:", content);
      throw e;
    }
    
    return actions.slice(0, 3);
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return [
      { id: "fallback-1", title: "Follow up on recent portfolio changes", priority: "High", owner: "Advisor", reason: "Standard check-in", blocked: false },
      { id: "fallback-2", title: "Schedule annual review meeting", priority: "Medium", owner: "Advisor", reason: "Annual requirement", blocked: false },
      { id: "fallback-3", title: "Send updated compliance documents", priority: "Low", owner: "Advisor", reason: "Compliance update", blocked: false }
    ]; 
  }
}

export async function detectKnowledgeGaps(clients, cpdModules) {
  try {
    const clientsData = clients.slice(0, 5).map(c => `${c.name} (${c.segment}): Needs ${c.needs.join(", ")}`).join("; ");
    const modulesData = cpdModules.map(m => `ID: ${m.id}, Title: ${m.title}`).join(" | ");

    const prompt = `
      You are an expert AI analyzing a financial advisor's book of business to find knowledge gaps and recommend CPD (Continuing Professional Development) courses.
      
      Here is a sample of their clients: ${clientsData}
      Here are the available CPD modules: ${modulesData}

      Detect exactly 3 knowledge gaps the advisor might have based on these clients' needs. 
      For each gap, map it to the most relevant CPD course ID from the available modules.
      
      Return ONLY a valid JSON array of objects with the following keys:
      - "id": a unique string like "gap-1"
      - "courseId": the ID of the matched CPD module
      - "label": a short sentence describing the gap (e.g., "Tax threshold flagged in recent notes")
      - "keyword": a short 1-2 word topic (e.g., "tax threshold")

      Do not include markdown formatting like \`\`\`json.
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    try {
      const cleanedContent = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed = JSON.parse(cleanedContent);
      if (parsed && !Array.isArray(parsed)) {
        const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
        if (possibleArray) parsed = possibleArray;
        else parsed = [parsed];
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      console.error("Failed to parse gaps:", content);
      throw e;
    }
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return [
      { id: "gap-1", courseId: "cpd-legacy", label: '"Trust structuring" mentioned in 3 client meetings this week', keyword: "trust structuring" },
      { id: "gap-2", courseId: "cpd-sme", label: '"Tax threshold" flagged in Ahmad\'s portfolio review notes', keyword: "tax threshold" },
      { id: "gap-3", courseId: "cpd-family", label: '"Lapse risk" detected in recent activity', keyword: "lapse risk" }
    ];
  }
}

export async function generateSmartLearningPath(advisor, clients, cpdModules, recentNotes = "") {
  try {
    const clientsData = clients.slice(0, 10).map(c => `${c.name}: ${c.segment}, Needs: ${c.needs.join(", ")}`).join("; ");
    const modulesData = cpdModules.map(m => `ID: ${m.id}, Title: ${m.title}, Target: ${m.clusterTarget}`).join(" | ");

    const prompt = `
      You are an expert AI analyzing a financial advisor's profile and their clients to recommend the single most strategic CPD (Continuing Professional Development) course.
      
      Advisor Level: ${advisor.experienceLevel}
      Advisor Clients: ${clientsData}
      Recent Gap Notes: ${recentNotes}

      Available CPD Modules: ${modulesData}

      Pick exactly ONE best CPD module ID from the available modules that will have the highest strategic impact for this advisor.
      Also provide a 1-2 sentence "strategicReasoning" explaining why this course was chosen based on their portfolio density or experience level.

      Return ONLY a valid JSON object with the following keys:
      - "moduleId": the exact ID of the chosen CPD module
      - "strategicReasoning": your explanation
      
      Do not include markdown formatting like \`\`\`json.
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    try {
      const cleanedContent = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed = JSON.parse(cleanedContent);
      
      const module = cpdModules.find(m => m.id === parsed.moduleId);
      return {
        module: module || cpdModules[0],
        strategicReasoning: parsed.strategicReasoning || "Standard recommendation based on general portfolio."
      };
    } catch(e) {
      console.error("Failed to parse learning path:", content);
      throw e;
    }
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return {
      module: cpdModules[0],
      strategicReasoning: "Fallback standard recommendation."
    };
  }
}
