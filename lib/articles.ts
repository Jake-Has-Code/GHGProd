export const articles = [
 {slug:'a-homelab-is-a-mindset',category:'HOMELAB',title:'A homelab is a mindset, not a server rack.',excerpt:'Start small. Break things. Learn something you can’t get from a tutorial.',readTime:3,sections:[
 ['Start with a question','A homelab doesn’t need blinking lights or a second electricity bill. It needs a question you want to answer. What happens when a DNS record changes? How do two containers find each other? Can you restore a file after you delete it? Pick one question, and give yourself a small place to explore it.'],
 ['Make the first experiment boring','An old laptop or a virtual machine is enough. Run a local web server. Put a page on it. Find the logs. Stop the service, read the error, and bring it back. You learn more from understanding a simple system completely than from copying a complicated stack you can’t explain.'],
 ['Keep a lab notebook','Write down the question, the change, and the result. Include the command that failed and what you thought it would do. A few plain text notes become a map back to your reasoning. Future you will appreciate the breadcrumb trail.'],
 ['Give curiosity some boundaries','Keep experiments separate from important personal data. Take snapshots, use disposable credentials, and work only on systems you own or have permission to test. A good lab makes failure cheap, predictable, and reversible.'],
 ['Then build it again','Rebuild the experiment from your notes. If you get stuck, that’s useful feedback: your notes need one more detail. The real project isn’t the server. It’s becoming someone who can explain what the server is doing.']
 ]},
 {slug:'security-is-a-habit',category:'CYBERSECURITY',title:'Security is a habit. Start with the small stuff.',excerpt:'A practical mindset for making everyday technology a little less fragile.',readTime:3,sections:[
 ['Think in layers','No single setting makes a system perfectly secure. Good habits reduce the number of easy ways things can go wrong. Start with the accounts and devices you rely on most, and build from there.'],
 ['Reduce password reuse','A password manager makes it practical to use a different password for each account. Reusing one password means a problem at one service can become a problem somewhere else. Protect the manager itself carefully, and keep its recovery information somewhere you can access when you need it.'],
 ['Make recovery part of setup','When you enable an additional authentication method, save its recovery codes. Check how you would get back into your email if your phone disappeared. Recovery is part of the system, not an afterthought.'],
 ['Pay attention to the prompt','Unexpected login approvals, urgent requests, and surprising attachments deserve a pause. Open the service through a route you already trust. Context is often more useful than trying to spot a single visual clue.'],
 ['Build a repeatable routine','Update your devices, review old account access, and test a backup restore. Put a small review on your calendar. Consistent, modest maintenance is easier to sustain than a yearly burst of panic.']
 ]},
 {slug:'small-tools-better-days',category:'TECH & TINKERING',title:'Small tools. Better days. A case for tinkering.',excerpt:'The best side project might be the tiny thing that solves your own problem.',readTime:3,sections:[
 ['Notice the repeated annoyance','Every useful little tool begins with a moment of friction. Maybe it’s renaming a folder of screenshots or checking whether your own website is up. Write down the annoyance before you reach for a framework.'],
 ['Keep version one small','A script that does one job clearly is a good project. Give it understandable inputs and a readable result. Make it tell you when something goes wrong. You can build a polished interface later, after you understand what the tool actually needs to do.'],
 ['Use a dry run','When a script changes files, add a way to show the planned changes first. Test on copies. A tiny convenience becomes much more useful when you trust it around your real work.'],
 ['Leave a note for someone else','Explain how to run it and what it expects. Include one working example. You don’t need a grand launch to share something useful; a clear note and a small repository are often enough.'],
 ['Keep the curiosity','Not every experiment needs to become a business or a product. Sometimes learning how something works is the entire point. Build the little thing. See where it takes you.']
 ]}
] as const;
