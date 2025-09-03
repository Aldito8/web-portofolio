import express from "express";
import { Pool } from "pg";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import flash from "express-flash";
import session from "express-session";
import multer from "multer";    

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "src/views"));

app.use("/assets", express.static("src/assets"));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: true,
}))
app.use(flash())

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './src/assets/uploads')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + Date.now() + path.extname(file.originalname))
    }
})

const upload = multer({ storage: storage })

app.engine(
    "hbs",
    engine({
        extname: ".hbs", 
        partialsDir: [
            path.join(__dirname, "src/views/partials"),
            path.join(__dirname, "src/views/experience")
        ],
        layoutsDir: path.join(__dirname, "src/views/layouts"),
        defaultLayout: "main",
    })
);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

// inisialisasi database
const db = new Pool({
    user: "postgres",
    password: "pgadmin61",
    host: "localhost",
    port: 5432,
    database: "porto",
    max: 20,
});

// home page
app.get("/", home);

// login page
app.get("/login", login)
app.post("/login", handlerLogin)
app.get("/logout", logout)

// register page
app.get("/register", register)
app.post("/register", handlerRegister)

// dashboard
app.get("/dashboard", dashboard)

// experience
app.get("/experience", experiencePage)
app.get("/experience/add", addExperience)
app.post("/experience/add", upload.single("logo"), handlerAddExperience)
app.get("/experience/edit/:id", editExperience)
app.post("/experience/edit/:id", upload.single("logo"), handlerEditExperience)
app.post("/experience/delete/:id", handlerDeleteExperience)

// project
app.get("/project", projectPage)
app.get("/project/add", addProject)
app.post("/project/add", upload.single("pic"), handlerAddProject)
app.get("/project/edit/:id", editProject)
app.post("/project/edit/:id", upload.single("pic"), handlerEditProject)
app.post("/project/delete/:id", handlerDeleteProject)

// technology
app.get("/technology", technologyPage)
app.get("/technology/add", addTechnology)
app.post("/technology/add", upload.single("icon"), handlerAddTechnology)
app.get("/technology/edit/:id", editTechnology)
app.post("/technology/edit/:id", upload.single("icon"), handlerEditTechnology)
app.post("/technology/delete/:id", handlerDeleteTechnology)

async function home(req, res) {
// read from database
    const readProject = `SELECT * FROM project ORDER BY id`
    const projectList = await db.query(readProject)

    const readExperience = `SELECT * FROM experience ORDER BY id`
    const experienceList = await db.query(readExperience)

    const readTechnology = `SELECT * FROM tech ORDER BY nametech`
    const technologyList = await db.query(readTechnology)

    const experience = experienceList.rows.map(data => ({
        id: data.id,
        namejob: data.namejob,
        company: data.company,
        activity: data.activity,
        technology: data.technology,
        datestart: formatMonthYear(data.datestart),
        dateend: data.dateend ? formatMonthYear(data.dateend) : 'Present',
        logo: data.logo ? data.logo : notAvailablePic
    }));

    const technology = technologyList.rows.map(data => ({
        nametech: data.nametech,
        icon: data.icon ? data.icon : notAvailablePic
    }));

    const project = projectList.rows.map(data => ({
        id: data.id,
        nameproject: data.nameproject,
        description: data.description,
        technology: data.technology,
        gitrepo: data.gitrepo,
        demo: data.demo,
        pic: data.pic ? data.pic : notAvailablePic
    }));

    res.render("index", { experience, technology, project, title: "Home Page" });
}

function login(req, res) {
    res.render("login", { message: req.flash('error'), title: "Login Page" })
}

function logout(req, res) {
    req.session.destroy()
    res.redirect("/login")
}

async function handlerLogin(req, res) {
    const { email, password } = req.body

    const isRegistered = await db.query(`SELECT * FROM public.user WHERE email = '${email}'`)

    const isMatch = await bcrypt.compare(password, isRegistered.rows[0].password)

    if (!isMatch) {
        req.flash("error", "password salah")
        return res.redirect('/login')
    }
    req.session.user = {
        name: isRegistered.rows[0].name
    }
    res.redirect('/dashboard')
}

function register(req, res) {
    res.render("register", { message: req.flash('error'), title: "Register Page" })
}

async function handlerRegister(req, res) {
    let { name, email, password } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)

    const isRegistered = await db.query(`SELECT * FROM public.user WHERE email = '${email}'`)

    if (isRegistered.rows.length > 0) {
        req.flash("error", "email sudah terdaftar")
        return res.redirect("/register")
    }

    const query = `INSERT INTO public.user(name, email, password) VALUES ('${name}', '${email}', '${hashedPassword}')`
    const result = await db.query(query)

    res.redirect('/login')

    console.log(req.body)
}

async function dashboard(req, res) {
    let userdata;

    if (req.session.user) {
        userdata = { name: req.session.user.name }
    }
    res.render("dashboard", { userdata, title: "Dashboard" })
}

// EXPERIENCE //
async function experiencePage(req, res) {

    const readExperience = `SELECT * FROM experience ORDER BY id`
    const experienceList = await db.query(readExperience)

    const experience = experienceList.rows.map(data => ({
        id: data.id,
        namejob: data.namejob,
        company: data.company,
        activity: data.activity,
        technology: data.technology,
        datestart: formatMonthYear(data.datestart),
        dateend: data.dateend ? formatMonthYear(data.dateend) : "N/A",
        logo: data.logo ? data.logo : notAvailablePic
    }));
    res.render("experience/experience", { experience })
}

function addExperience(req, res) {
    res.render("experience/addexperience", { title: "Add Experience" })
}

async function handlerAddExperience(req, res) {
    let { namejob, company, activity, technology, datestart, dateend } = req.body;

    const wrapDate = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return 'NULL';
        return `'${dateStr}'`;
    };

    datestart = wrapDate(req.body.datestart);
    dateend = wrapDate(req.body.dateend);

    const formatPgArray = (input) => {
        const arr = Array.isArray(input) ? input : [input];
        return `{${arr.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',')}}`;
    };

    const insertQuery = `INSERT INTO experience(namejob, company, activity, technology, datestart, dateend, logo) VALUES ('${namejob}', '${company}', '${formatPgArray(activity)}', '${formatPgArray(technology)}', ${datestart}, ${dateend}, '${req.file.filename}')`

    const insertResult = await db.query(insertQuery)

    res.redirect("/experience")

}

async function editExperience(req, res) {
    let { id } = req.params
    const readQuery = `SELECT * FROM experience WHERE id = ${id}`
    const readResult = await db.query(readQuery)
    const data = readResult.rows[0]
    const _datestart = data.datestart.toISOString().split("T")[0]
    data.datestart = _datestart
    data.logo = data.logo ? data.logo : notAvailablePic


    res.render("experience/editexperience", { data, title: `${data.namejob}` })
}

async function handlerEditExperience(req, res) {

    let { id } = req.params
    let { namejob, company, activity, technology, datestart, dateend } = req.body

    const wrapDate = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return 'NULL';
        return `'${dateStr}'`;
    };

    datestart = wrapDate(req.body.datestart);
    dateend = wrapDate(req.body.dateend);

    const formatPgArray = (input) => {
        const arr = Array.isArray(input) ? input : [input];
        return `{${arr.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',')}}`;
    };

    const updateQuery = `UPDATE experience SET namejob = '${namejob}', company = '${company}', activity = '${formatPgArray(activity)}', technology = '${formatPgArray(technology)}', datestart = ${datestart}, dateend = ${dateend}, logo = '${req.file.filename}' WHERE id = ${id}`
    const insertResult = await db.query(updateQuery)
    res.redirect("/experience")
}

async function handlerDeleteExperience(req, res) {
    const { id } = req.params;
    await db.query(`DELETE FROM experience WHERE id = ${id}`);
    res.redirect('/experience')
}

// PROJECT //

async function projectPage(req, res) {

    const readProject = `SELECT * FROM project ORDER BY id`
    const projectList = await db.query(readProject)

    const project = projectList.rows.map(data => ({
        id: data.id,
        nameproject: data.nameproject,
        description: data.description,
        technology: data.technology,
        gitrepo: data.gitrepo,
        demo: data.demo,
        pic: data.pic ? data.pic : notAvailablePic
    }));

    res.render("project/project", { project })
}

function addProject(req, res) {
    res.render("project/addproject", { title: "Add Project" })
}

async function handlerAddProject(req, res) {
    let { nameproject, description, technology, gitrepo, demo } = req.body;

    const formatPgArray = (input) => {
        const arr = Array.isArray(input) ? input : [input];
        return `{${arr.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',')}}`;
    };

    const insertQuery = `INSERT INTO project(nameproject, description, technology, gitrepo, demo, pic) VALUES ('${nameproject}', '${description}', '${formatPgArray(technology)}', '${gitrepo}', '${demo}', '${req.file.filename}')`

    const insertResult = await db.query(insertQuery)

    console.log(insertQuery)
}

async function editProject(req, res) {
    let { id } = req.params
    const query = `SELECT * FROM project WHERE id = ${id}`
    const result = await db.query(query)
    const data = result.rows[0]

    res.render("project/editproject", { data, title: `${data.nameproject}` })
}

async function handlerEditProject(req, res) {

    let { id } = req.params
    let { nameproject, description, technology, gitrepo, demo } = req.body;

    const formatPgArray = (input) => {
        const arr = Array.isArray(input) ? input : [input];
        return `{${arr.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',')}}`;
    };

    const updateQuery = `UPDATE project SET nameproject = '${nameproject}', description = '${description}', technology = '${formatPgArray(technology)}', gitrepo = '${gitrepo}', demo = '${demo}', pic = '${req.file.filename}' WHERE id = ${id}`

    const insertResult = await db.query(updateQuery)
}

async function handlerDeleteProject(req, res) {
    const { id } = req.params;
    await db.query(`DELETE FROM project WHERE id = ${id}`);
    res.redirect('/project')
}

// TECHNOLOGY //

async function technologyPage(req, res) {

    const readTechnology = `SELECT * FROM tech ORDER BY id`
    const technologyList = await db.query(readTechnology)


    const technology = technologyList.rows.map(data => ({
        id: data.id,
        nametech: data.nametech,
        icon: data.icon ? data.icon : notAvailablePic
    }));
    res.render("technology/technology", { technology })
}

function addTechnology(req, res) {
    res.render("technology/addtechnology", { title: "Add Technology" })
}

async function handlerAddTechnology(req, res) {
    let { nametech } = req.body;

    const insertQuery = `INSERT INTO tech(nametech, icon) VALUES ('${nametech}','${req.file.filename}')`

    const insertResult = await db.query(insertQuery)

    console.log(insertQuery)
}

async function editTechnology(req, res) {
    let { id } = req.params
    const query = `SELECT * FROM tech WHERE id = ${id}`
    const result = await db.query(query)
    const data = result.rows[0]

    res.render("technology/edittechnology", { data, title: `${data.nametech}` })
}

async function handlerEditTechnology(req, res) {
    let { id } = req.params
    let { nametech } = req.body;

    const updateQuery = `UPDATE tech SET nametech = '${nametech}', icon = '${req.file.filename}' WHERE id = ${id}`
    const insertResult = await db.query(updateQuery)
}

async function handlerDeleteTechnology(req, res) {
    const { id } = req.params;
    await db.query(`DELETE FROM tech WHERE id = ${id}`);
    res.redirect('/technology')
}

// date format
const formatMonthYear = date => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
};

const notAvailablePic = `https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg`