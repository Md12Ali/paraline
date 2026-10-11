# ParaLine — বাংলা গাইড

ParaLine একটি অ্যান্ড্রয়েড অ্যাপ যা ইংরেজি লেখা নতুনভাবে লিখে দেয় (paraphrase / humanize), আর প্রতিটি লাইন নিজের জায়গায় রাখে।

## ওয়েবসাইট

- ঠিকানা: https://paraline.onrender.com (Render-এর ফ্রি static site)
- `main` branch-এ নতুন কিছু push হলে Render নিজে থেকেই আবার ডিপ্লয় করে।
- সাইটের ফাইল: `app/src/main/assets/` (মূল পাতা, ইঞ্জিন) আর `web/` (আইকন, অফলাইন সাপোর্ট, privacy পাতা)। `build-site.sh` এগুলো `public/` ফোল্ডারে জড়ো করে।
- ফোনে Chrome-এ সাইট খুলে মেনু থেকে "Add to Home screen" দিলে অ্যাপের মতো আইকন বসে, আর একবার খোলার পর ইন্টারনেট ছাড়াও চলে।

## অ্যাপে কী আছে

- **Offline মোড**: ফোনের ভেতরেই চলে। ফ্রি, কোনো লিমিট নেই, ইন্টারনেট লাগে না। এটি নিয়ম-ভিত্তিক ইঞ্জিন: শব্দ ও বাক্যাংশ বদলায়, তাই পরিবর্তন মাঝারি মানের।
- **AI মোড**: ইউজার নিজের ফ্রি Google Gemini API key দিলে অনেক ভালো মানের রিরাইট হয়। ফ্রি key-র দৈনিক সীমা Google ঠিক করে; সীমা শেষ হলে বাকি অংশ অফলাইনে হয়ে যায়।
- ৬টি স্টাইল (Standard, Humanize, Formal, Simple, Creative, Shorten) ও ৩টি মাত্রা।
- লিংক, ইমেইল, সংখ্যা, নাম, কোটেশনের ভেতরের লেখা, বুলেট, নম্বর, ফাঁকা লাইন বদলায় না।
- লাইন নম্বরে ট্যাপ করলে শুধু ঐ লাইন আবার লেখা হয়।

## ফোন থেকে APK বানানো (GitHub দিয়ে)

১. github.com-এ একটি নতুন **Private** repository খুলুন (নাম যেমন `paraline`)।
২. `Add file → Upload files` দিয়ে `ParaLine-source.zip` ফাইলটি আপলোড করে Commit করুন।
৩. `Add file → Create new file` চাপুন। ফাইলের নাম হুবহু লিখুন: `.github/workflows/build.yml`
   এরপর আলাদা করে দেওয়া `build.yml` ফাইলের পুরো লেখা পেস্ট করে Commit করুন।
৪. উপরের **Actions** ট্যাবে যান। "Build ParaLine" চলতে শুরু করবে (৫ থেকে ১০ মিনিট)।
৫. শেষ হলে ঐ run-এ ঢুকে নিচে **Artifacts → ParaLine-app** ডাউনলোড করুন। zip খুললে `ParaLine-test.apk` পাবেন। এটি ফোনে ইনস্টল করে পরীক্ষা করুন।

## Google Play-এর জন্য সাইন করা ফাইল (AAB)

১. repository-র `Settings → Secrets and variables → Actions → New repository secret`
   নাম: `KEYSTORE_PASSWORD`, মান: নিজের একটি শক্ত পাসওয়ার্ড (কোথাও লিখে রাখুন)।
২. `Actions → Build ParaLine → Run workflow`, task হিসেবে `make-signing-key` বেছে চালান।
৩. শেষ হলে artifact `signing-key-KEEP-PRIVATE` ডাউনলোড করুন (১ দিন পর মুছে যায়)। ভেতরের `upload.jks` নিরাপদ জায়গায় রাখুন।
৪. `KEYSTORE_BASE64.txt` ফাইলের পুরো লেখা কপি করে আরেকটি secret বানান, নাম: `KEYSTORE_BASE64`।
৫. আবার `Run workflow` চালান, task `build`। এবার artifact-এ `ParaLine-GooglePlay.aab` থাকবে। এই ফাইলই Play Console-এ আপলোড করবেন।

প্রতিবার নতুন build-এ version নম্বর নিজে থেকেই বাড়ে।

## Play Store-এ দেওয়ার আগে জানা দরকার

- ডেভেলপার অ্যাকাউন্টে এককালীন ২৫ ডলার ফি লাগে।
- নতুন ব্যক্তিগত অ্যাকাউন্টে Google সাধারণত আগে closed testing চায় (কমপক্ষে ১২ জন টেস্টার, টানা ১৪ দিন), তারপর production-এ ছাড়া যায়। Play Console-এ বর্তমান নিয়ম দেখে নিন।
- অ্যাপের ID এখন `com.paraline.rewriter`। প্রথম আপলোডের পর এটি আর বদলানো যায় না। নিজের ID চাইলে আগে `app/build.gradle`-এ `applicationId` বদলান।
- একটি Privacy Policy-র পাবলিক লিংক লাগবে। `store/privacy-policy.html` ফাইলে নিজের ইমেইল বসিয়ে যেকোনো ফ্রি হোস্টিংয়ে দিন।
- `store/` ফোল্ডারে আইকন (512), feature graphic (1024x500), ৩টি স্ক্রিনশট, আর `play-listing.txt`-এ নাম, বর্ণনা ও Data safety ফর্মের উত্তর দেওয়া আছে।
- "ParaLine" নামটি বদলাতে চাইলে `app/src/main/res/values/strings.xml` আর `assets/index.html`-এ বদলান। একই নামের অন্য অ্যাপ বা ট্রেডমার্ক আছে কি না Play Store-এ খুঁজে দেখুন।

## সততার সাথে সীমাবদ্ধতা

- "আনলিমিটেড + ফ্রি + সেরা মান" একসাথে সম্ভব শুধু Offline মোডে আনলিমিটেড, আর AI মোডে সেরা মান (Google-এর ফ্রি সীমার ভেতরে)।
- Offline ইঞ্জিন শুধু ইংরেজি বদলায়; অন্য ভাষার লাইন অপরিবর্তিত থাকে। AI মোড অন্য ভাষাও পারে।
- অ্যাপটি আসল ফোনে এখনো চালিয়ে দেখা হয়নি; প্রথম build-এর পর নিজে পরীক্ষা করুন।
