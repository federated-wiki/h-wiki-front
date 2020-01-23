import React from 'react';
import Page from './components/Page';
import { connect } from '@holochain/hc-web-client';
import './styles/App.scss';
import Editor from './components/Editor';
import PreviewSection from './components/PreviewSection';
import { MdCreate, MdAdd, MdClose,  } from "react-icons/md";

/** Apollo cliente, GraphQL */
import { ApolloClient, InMemoryCache, gql } from "apollo-boost";
import { resolvers } from "./graphql/resolvers";
import { typeDefs } from "./graphql/schema";
import { SchemaLink } from "apollo-link-schema";
import { makeExecutableSchema } from "graphql-tools";


class App extends React.Component {

  constructor(props) {
      super(props);

      this.state = {
        existingPages: [],
        pages: [],
        newData: {
          title: '',
          sections: [
          ]
        },
        statusPreload: '',
        pageData: {
          title: '',
          sections: [],
          position: undefined
        },
        existingPage: false,
        editorSettings: [],
        pageDataProcess: {},
        previewData: {},
        clearingCache: false,

        //Variables booleanas para mostrar contenido
        showPageManager: false, 
        showEditor: false,
        alert: false,
        confirmation: false,
        confirmationMsg: 'equis',
        preloader: false,
        loadingPage: true,
      };

      this.pagesContainer = React.createRef();
  }

  componentDidMount() {
    connect({ url: "ws://192.168.1.63:50001" })
    .then((context) => {
      const schema = makeExecutableSchema({
        typeDefs,
        resolvers
      });
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new SchemaLink({ schema, context })
      })
      this.setState({ client: client });
      client
        .query({
          query: gql`
            {
              homePage {
                title
                sections {
                  content
                }
              }
            }
          `
        })
        .then(e =>{
          let homePage = e.data.homePage;

          if (!homePage.sections[0].content.length) {
            homePage.sections[0].content = 'This is the page of H-wiki';
            homePage.noLinks = true;
          }     

          this.setState({ pages: [homePage], loadingPage: false })
        })
        .catch(e => console.log("object", e));
    });
  }
    
  showPage(e){
    e.preventDefault();
    this.setState({loadingPage: true})
    this.state.client
    .query({
      query: gql`
        {
          page(title:"${e.target.textContent}") {
            title
            sections {
              id
              type
              content
              rendered_content
            }
          }
        }
      `
    })
    .then(page => {
      page = page.data.page;
      var pages = this.state.pages;
      pages.splice(this.getPagePositionPage(e) + 1, pages.length);
      pages = [...pages, page];
      this.setState({
        pages,
        loadingPage: false
      }, (_this=this) => {
        _this.pagesContainer.current.scrollTo(window.innerWidth, 0);
      });
    });
  }

  storePage = () => {
    this.setState({
      alert: true,
      preloader: true,
      preloaderMsg: 'storing page'
    });
    this.state.client
      .mutate({
        mutation: gql`
          mutation CreatePageWithSections(
            $title: String!
            $sections: [SectionInput!]!
          ) {
            createPageWithSections(title: $title, sections: $sections) {
              title
              sections {
                id
                type
                content
                rendered_content
              }
            }
          }
        `,
        variables: { title: this.state.pageData.title, sections: this.state.pageData.sections }
      })
      .then(e => {
        var pages = this.stateAssignment(this.state.pages),
            newLink = {content: "["+ this.state.pageData.title +"](#)", __typename: "Section"};

        if (this.state.pages[0].noLinks) {
          pages[0].sections = [newLink];
          pages[0].noLinks = false;
        } else {
          pages[0].sections.push(newLink);
        }

        this.setState({
          pages,
          preloader: false,
          alert: false
        }, (_this=this)=>{
          _this.closePageManager();
        });
        
      });
  }

  showEditor = (mode, pos = undefined) => { 
    this.setState({
      editorSettings: [{
        mode: mode,
        pos: pos
      }]
    }, (_this=this)=>{
      _this.setState({ showEditor: true })
    });
  }

  closeEditor(){
    this.setState({
      editorSettings: []
    }, (_this=this)=>{
      _this.setState({
        showEditor: false,
      })
    });
  }

  showPageManager = () => { this.setState({ showPageManager: true }); }
  closePageManager = () => { this.setState({ showPageManager: false }); }

  createPage = () =>{
    var _this = this;
    this.setState({
      pageData: {
        title: '',
        sections: [],
        position: undefined
      },
      existingPage: false,
    }, ()=> {
      _this.showPageManager();
    });
  }

  showPageData = (pos) => {
    var currentPage = this.stateAssignment(this.state.pages[pos]),
      _this = this;
    currentPage.position = pos;

    this.setState({
      pageData: currentPage,
      existingPage: true
    }, ()=> {
      _this.showPageManager();
    });
  }

  getPagePositionPage = (e)=> {
    let el = e.target,
        parent = el.parentNode,
        cont = 2,
        pos;

    for (var i = 0; i<cont; i++) {
      if (parent.dataset.page) {
        pos = parent.dataset.page;
        break
      } 
      parent = parent.parentNode;
      cont+=1;
    }
    return parseInt(pos);
  }

  updatePageTitle = (e)=> {
      let pageData = this.state.pageData;
      pageData.title = e.target.value;
      this.setState({ pageData: {...pageData} });
  }

  getContentSection = (pos) =>{
    return this.state.pageData.sections[pos];
  }

  stateAssignment(state){
    var newState = JSON.stringify(state);
    return JSON.parse(newState);
  }

  async updatePageSections(mode, pos, content, currentSection) {
    let state = {},
        section = {
          type: 'text',
          content: content,
          rendered_content: 'text/html'
        },
        pageData = this.stateAssignment(this.state.pageData),
        secitonUpdated;
    
    if (this.state.existingPage) {

      this.setState({ preloader: true});

      if (mode === 'addns') {

        await this.state.client
        .mutate({
          mutation: gql`
            mutation addSectionToPage(
              $title: String!
              $section: SectionInput!
            ) {
              addSectionToPage(title: $title, section: $section) {
                title
                sections {
                  id
                  type
                  content
                  rendered_content
                }
              }
            }
          `,
          variables: {title: pageData.title, section: section}
        })
        .then(res => {
          var updatedPage = res.data.addSectionToPage;
          console.log('Updated page for addSectionToPage : ', updatedPage);
        });

      } else if (mode === 'addsb') {
        
        var sections = [];
        for (let i in pageData.sections) {
            sections.push(pageData.sections[i].id);          
        }

        await this.state.client
        .mutate({
          mutation: gql`
            mutation addOrderedSectionToPage(
              $title:String!
              $beforeSection: ID!
              $section: SectionInput!
              $sections: [ID!]!
            ) {
              addOrderedSectionToPage(
                title: $title,
                beforeSection: $beforeSection,
                section: $section,
                sections: $sections
              ) {
                title
                sections {
                  id
                  type
                  content
                  rendered_content
                }
              }
            }
          `,
          variables: {
            title: pageData.title,
            beforeSection: pageData.sections[pos].id,
            section,
            sections
          }
        })
        .then(res => {
          var updatedPage = res.data;
          console.log('Updated page for addOrderedSectionToPage : ', updatedPage);

        });

      } else if (mode === 'edit') {

        await this.state.client
        .mutate({
          mutation: gql`
            mutation UpdateSection(
              $id: ID!
              $section: SectionInput!
            ) {
              updateSection(id: $id, section: $section) {
                  id
                  typeupdatePageSections
                  content
                  rendered_content
              }
            }
          `,
          variables: { id: currentSection.id, section: {
            type: currentSection.type,
            content,
            rendered_content: currentSection.rendered_content
          }}
        })
        .then(res => {
          secitonUpdated = res.data.updateSection;
          pageData.sections.splice(pos, 1, secitonUpdated);

          let pages = this.stateAssignment(this.state.pages);
          pages.splice(pageData.position, 1, pageData);

          state = {
            pageData,
            pages
          };

        });

      }
      state.alert = false;
      state.preloader = false;
    } else {

      if (mode === 'addns') {
        
        pageData.sections.push(section);
        state = {pageData};

      } else if (mode === 'addsb') {
        
        pageData.sections.splice((pos+1), 0, section);
        state = {pageData};

      } else if (mode === 'edit') {

        secitonUpdated = currentSection;
        secitonUpdated.content = content;
        pageData.sections.splice(pos, 1, secitonUpdated);

        state = { pageData };
        state.alert = false;
      }

    }

    this.setState(state, (_this=this)=>{
      _this.closeEditor();
    });

  }

  async removeSection(pos) {
    var pageData = this.stateAssignment(this.state.pageData),
        pages = this.stateAssignment(this.state.pages),
        state;
        
    if (this.state.existingPage) {
      
      this.setState({ 
        preloader: true,
        preloaderMsg: 'removing section'
      });

      await this.state.client
      .mutate({
        mutation: gql`
          mutation removeSection(
            $id: ID!
          ) {
            removeSection(id: $id) {
              title
              sections{
                id
                type
                content
                rendered_content
              }
            }
          }
        `,
        variables: { id: pageData.sections[pos].id}
      })
      .then(res => {

        pageData.sections.splice(pos, 1);
        pages.splice(pageData.position, 1, pageData);

        state = {
          pageData,
          pages
        };
      });
    } else {
      pageData.sections.splice(pos, 1);
      state = {
        pageData
      };
    }

    this.setState(state, (_this=this)=>{
      var _state = {alert: false};
      if (_this.state.existingPage) {
        _state.preloader = false;
      }
      _this.setState(_state);
    });
  }

  showConfirmation(pageDataProcess) {
    this.setState({
      alert: true,
      confirmation: true,
      confirmationMsg: 'Are you sure you want to '+ pageDataProcess.process +' this?',
      pageDataProcess
    });
  }

  processPageData = () =>{
    this.setState({
      confirmation: false     
    }, (_this=this, pageDataProcess = this.state.pageDataProcess)=>{
      if (pageDataProcess.process === 'update') {
        _this.updatePageSections(
          pageDataProcess.mode,
          pageDataProcess.pos,
          pageDataProcess.content,
          pageDataProcess.currentSection
        );
      } else if (pageDataProcess.process === 'remove') {
        _this.removeSection(pageDataProcess.pos);
      }
    });
  }

  closeConfirmation = () => {
    this.setState({
      alert:false,
      confirmation:false,
      pageDataProcess: {}
    });
  }

  closePreloader = () => {
    this.setState({
      alert:false,
      preloader:false,
    });
  }

  render() {
    return (
      <div id='container'>

        <header>
          <div><div></div></div>

          <div>
            <button onClick={this.createPage}>Create page</button>
          </div>

          {this.state.loadingPage &&
            <div className='linear-preloader'>
              <div></div>
            </div>
          }
        </header>

        <section ref={this.pagesContainer}>
          <div>
            {this.state.pages.map((pageData, key) => {
                return (
                  <div key={key} data-page={key}>
                    <div>
                      {key !== 0 && <button onClick={e =>{this.showPageData(key)}}>
                        <MdCreate />
                      </button>}
                    </div>
                    <Page data={pageData} showPage = {this.showPage.bind(this)}  />
                  </div>
                )
              })}
          </div>
          {this.state.loadingPage && <div className='blocker'></div>}
        </section>

        {this.state.showPageManager &&
          <div id='page-manager'>
            <div>
              <header>
                <div>
                  <label>
                    { this.state.existingPage ? this.state.pageData.title : 'Create page' }
                  </label>
                </div>
                <div>
                  {this.state.existingPage && 
                    <button onClick={this.closePageManager}>
                      <MdClose />
                    </button>
                  }
                </div>
              </header>
              <section>
                {!this.state.existingPage &&
                  <div>
                    <input 
                      type='text'
                      value={this.state.pageData.title}
                      onChange={this.updatePageTitle}
                      placeholder='Page title'
                      className={this.state.existingPage ? 'readonly' : ''}
                    />
                  </div>
                }
                <div>

                  {!this.state.pageData.sections.length &&
                    <button onClick={e=>{this.showEditor('addns')}}>
                      <MdAdd />Add section
                    </button>
                  }

                  {this.state.pageData.sections.map((data, key) => {
                    return(
                      <PreviewSection 
                        key = {key}
                        pos = {key}
                        content = {data.content}
                        showEditor = {this.showEditor.bind(this)}
                        removeSection = {this.removeSection.bind(this)}
                        showConfirmation={this.showConfirmation.bind(this)}
                      />
                    )
                  })}

                </div>
              </section>
              {!this.state.existingPage &&
                <footer>
                  <div>
                    <div>
                      <button onClick={this.closePageManager}>Cancel</button>
                      <button onClick={this.storePage}>{this.state.existingPage ? 'Update' : 'Save' }</button>
                    </div>
                  </div>
                </footer>
              }
            </div>
          </div>
        }

        {this.state.showEditor &&
          this.state.editorSettings.map((param, key) => {
            return(
              <Editor
                key = {key}
                pos = {param.pos}
                mode = {param.mode}
                getContentSection = {this.getContentSection.bind(this)}
                updatePageSections = {this.updatePageSections.bind(this)}
                closeEditor = {this.closeEditor.bind(this)}
                showConfirmation={this.showConfirmation.bind(this)}
              />
            )
          })
        }
        
        {this.state.alert &&
          <div id='alert'>
            {this.state.confirmation &&
              <div className='confirmation'>
                <div>
                  <label>{this.state.confirmationMsg}</label>
                </div>
                <div>
                  <button onClick={this.closeConfirmation}>No</button>
                  <button onClick={this.processPageData}>Yes</button>
                </div>
              </div>
            }

            {this.state.preloader &&
              <div className='preloader'>
                <div>
                  <label>{this.state.preloaderMsg}</label>
                </div>  
                <div>
                  <label>processing...</label>
                </div>
              </div>
            }
          </div>
        }
      </div>
    )
  }
}

export default App;