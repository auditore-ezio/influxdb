import {Organization, AppState} from '../../src/types'

describe('Dashboard', () => {
  beforeEach(() => {
    cy.flush()

    cy.signin().then(({body}) => {
      cy.wrap(body.org).as('org')
    })

    cy.fixture('routes').then(({orgs}) => {
      cy.get('@org').then(({id: orgID}: Organization) => {
        cy.visit(`${orgs}/${orgID}/dashboards`)
      })
    })
  })

  it("can edit a dashboard's name", () => {
    cy.get('@org').then(({id: orgID}: Organization) => {
      cy.createDashboard(orgID).then(({body}) => {
        cy.fixture('routes').then(({orgs}) => {
          cy.visit(`${orgs}/${orgID}/dashboards/${body.id}`)
        })
      })
    })

    const newName = 'new 🅱️ashboard'

    cy.get('.renamable-page-title').click()
    cy.get('.cf-input-field')
      .type(newName)
      .type('{enter}')

    cy.fixture('routes').then(({orgs}) => {
      cy.get('@org').then(({id: orgID}: Organization) => {
        cy.visit(`${orgs}/${orgID}/dashboards`)
      })
    })

    cy.getByTestID('dashboard-card').should('contain', newName)
  })

  it('can create a View and Note cell', () => {
    cy.get('@org').then(({id: orgID}: Organization) => {
      cy.createDashboard(orgID).then(({body}) => {
        cy.fixture('routes').then(({orgs}) => {
          cy.visit(`${orgs}/${orgID}/dashboards/${body.id}`)
        })
      })
    })

    // View cell
    cy.getByTestID('add-cell--button').click()
    cy.getByTestID('save-cell--button').click()
    cy.getByTestID('cell--view-empty').should('have.length', 1)

    // Remove view cell
    cy.getByTestID('cell-context--toggle').click()
    cy.getByTestID('cell-context--delete').click()
    cy.getByTestID('cell-context--delete-confirm').click()

    cy.getByTestID('empty-state').should('exist')

    const noteText = 'this is a note cell'

    // Note cell
    cy.getByTestID('add-note--button').click()
    cy.getByTestID('note-editor--overlay').within(() => {
      cy.get('.CodeMirror').type(noteText)
      cy.getByTestID('save-note--button').click()
    })

    cy.getByTestID('cell--view-empty').contains(noteText)
  })

  // fix for https://github.com/influxdata/influxdb/issues/15239
  it('retains the cell content after canceling an edit to the cell', () => {
    cy.get('@org').then(({id: orgID}: Organization) => {
      cy.createDashboard(orgID).then(({body}) => {
        cy.fixture('routes').then(({orgs}) => {
          cy.visit(`${orgs}/${orgID}/dashboards/${body.id}`)
        })
      })
    })

    // Add an empty celly cell
    cy.getByTestID('add-cell--button').click()
    cy.getByTestID('save-cell--button').click()
    cy.getByTestID('cell--view-empty').should('be.visible')

    cy.getByTestID('cell--view-empty')
      .invoke('text')
      .then(cellContent => {
        // cellContent is yielded as a cutesy phrase from src/shared/copy/cell

        // open Cell Editor Overlay
        cy.getByTestID('cell-context--toggle').click()
        cy.getByTestID('cell-context--configure').click()

        // Cancel edit
        cy.getByTestID('cancel-cell-edit--button').click()

        // Cell content should remain
        cy.getByTestID('cell--view-empty').contains(cellContent)
      })
  })

  const getSelectedVariable = (contextID: string, index?: number) => win => {
    const state = win.store.getState() as AppState
    const defaultVarOrder = state.resources.variables.allIDs
    const defaultVarDawg =
      state.resources.variables.byID[defaultVarOrder[index]] || {}
    const filledVarDawg =
      (state.resources.variables.values[contextID] || {values: {}}).values[
        defaultVarOrder[index]
      ] || {}

    const hydratedVarDawg = {
      ...defaultVarDawg,
      ...filledVarDawg,
    }

    if (hydratedVarDawg.arguments.type === 'map') {
      if (!hydratedVarDawg.selected) {
        hydratedVarDawg.selected = [
          Object.keys(hydratedVarDawg.arguments.values)[0],
        ]
      }

      return hydratedVarDawg.arguments.values[hydratedVarDawg.selected[0]]
    }

    if (!hydratedVarDawg.selected) {
      hydratedVarDawg.selected = [hydratedVarDawg.arguments.values[0]]
    }

    return hydratedVarDawg.selected[0]
  }

  it('can manage variable state with a lot of pointing and clicking', () => {
    cy.get('@org').then(({id: orgID}: Organization) => {
      cy.createDashboard(orgID).then(({body: dashboard}) => {
        cy.createCSVVariable(orgID)
        cy.createQueryVariable(orgID)
        cy.createMapVariable(orgID).then(() => {
          cy.fixture('routes').then(({orgs}) => {
            cy.visit(`${orgs}/${orgID}/dashboards/${dashboard.id}`)
          })
          // add cell with variable in its query
          cy.getByTestID('add-cell--button').click()
          cy.getByTestID('switch-to-script-editor').should('be.visible')
          cy.getByTestID('switch-to-script-editor').click()
          cy.getByTestID('toolbar-tab').click()

          // check to see if the default timeRange variables are available
          cy.get('.flux-toolbar--list-item').contains('timeRangeStart')
          cy.get('.flux-toolbar--list-item').contains('timeRangeStop')
          cy.get('.flux-toolbar--list-item')
            .first()
            .within(() => {
              cy.get('.cf-button').click()
            })

          cy.getByTestID('flux-editor')
            .should('be.visible')
            .click()
            .focused()
            .type(' ')
          cy.get('.flux-toolbar--list-item')
            .eq(2)
            .within(() => {
              cy.get('.cf-button').click()
            })
          cy.getByTestID('save-cell--button').click()

          // TESTING CSV VARIABLE
          // selected value in dashboard is 1st value
          cy.getByTestID('variable-dropdown')
            .eq(0)
            .should('contain', 'c1')
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 0))
            .should('equal', 'c1')

          // sanity check on the url before beginning
          cy.location('search').should('eq', '?lower=now%28%29%20-%201h')

          // select 3rd value in dashboard
          cy.getByTestID('variable-dropdown--button')
            .eq(0)
            .click()
          cy.get(`#c3`).click()

          // selected value in dashboard is 3rd value
          cy.getByTestID('variable-dropdown')
            .eq(0)
            .should('contain', 'c3')
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 0))
            .should('equal', 'c3')

          // and that it updates the variable in the URL
          cy.location('search').should(
            'eq',
            '?lower=now%28%29%20-%201h&vars%5BCSVVariable%5D=c3'
          )

          // select 2nd value in dashboard
          cy.getByTestID('variable-dropdown--button')
            .eq(0)
            .click()
          cy.get(`#c2`).click()

          // and that it updates the variable in the URL without breaking stuff
          cy.location('search').should(
            'eq',
            '?lower=now%28%29%20-%201h&vars%5BCSVVariable%5D=c2'
          )

          // open CEO
          cy.getByTestID('cell-context--toggle').click()
          cy.getByTestID('cell-context--configure').click()

          // selected value in cell context is 2nd value
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 0))
            .should('equal', 'c2')

          cy.getByTestID('toolbar-tab').click()
          cy.get('.flux-toolbar--list-item')
            .first()
            .trigger('mouseover')
          // toggle the variable dropdown in the VEO cell dashboard
          cy.getByTestID('toolbar-popover--contents').within(() => {
            cy.getByTestID('variable-dropdown--button').click()
            // select 1st value in cell
            cy.getByTestID('variable-dropdown--item')
              .first()
              .click()
          })
          // save cell
          cy.getByTestID('save-cell--button').click()

          // selected value in cell context is 1st value
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 0))
            .should('equal', 'c1')

          // selected value in dashboard is 1st value
          cy.getByTestID('variable-dropdown').should('contain', 'c1')
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 0))
            .should('equal', 'c1')

          // TESTING MAP VARIABLE
          // selected value in dashboard is 1st value
          cy.getByTestID('variable-dropdown')
            .eq(1)
            .should('contain', 'k1')
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 2))
            .should('equal', 'v1')

          // select 2nd value in dashboard
          cy.getByTestID('variable-dropdown--button')
            .eq(1)
            .click()
          cy.get(`#k2`).click()

          // selected value in dashboard is 2nd value
          cy.getByTestID('variable-dropdown')
            .eq(1)
            .should('contain', 'k2')
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 2))
            .should('equal', 'v2')

          // open CEO
          cy.getByTestID('cell-context--toggle').click()
          cy.getByTestID('cell-context--configure').click()
          cy.getByTestID('toolbar-tab').should('be.visible')

          // selected value in cell context is 2nd value
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 2))
            .should('equal', 'v2')

          cy.getByTestID('toolbar-tab').click()
          cy.get('.flux-toolbar--list-item')
            .eq(2)
            .trigger('mouseover')
          // toggle the variable dropdown in the VEO cell dashboard
          cy.getByTestID('toolbar-popover--contents').within(() => {
            cy.getByTestID('variable-dropdown--button').click()
            // select 1st value in cell
            cy.getByTestID('variable-dropdown--item')
              .first()
              .click()
          })
          // save cell
          cy.getByTestID('save-cell--button').click()

          // selected value in cell context is 1st value
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 2))
            .should('equal', 'v1')

          // selected value in dashboard is 1st value
          cy.getByTestID('variable-dropdown').should('contain', 'k1')
          cy.window()
            .pipe(getSelectedVariable(dashboard.id, 2))
            .should('equal', 'v1')
        })
      })
    })
  })

  /*\
    built to approximate an instance with docker metrics,
    operating with the variables:

        depbuck:
            from(bucket: v.buckets)
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "docker_container_cpu")
                |> keep(columns: ["container_name"])
                |> rename(columns: {"container_name": "_value"})
                |> last()
                |> group()

        buckets:
            buckets()
                |> filter(fn: (r) => r.name !~ /^_/)
                |> rename(columns: {name: "_value"})
                |> keep(columns: ["_value"])

    and a dashboard built of :
        cell one:
            from(bucket: v.buckets)
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "docker_container_cpu")
                |> filter(fn: (r) => r["_field"] == "usage_percent")

        cell two:
            from(bucket: v.buckets)
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "docker_container_cpu")
                |> filter(fn: (r) => r["_field"] == "usage_percent")
                |> filter(fn: (r) => r["container_name"] == v.depbuck)

    with only 4 api queries being sent to fulfill it all

  \*/
  it('can load dependent queries without much fuss', () => {
    cy.get('@org').then(({id: orgID}: Organization) => {
      cy.createDashboard(orgID).then(({body: dashboard}) => {
        const now = Date.now()
        cy.writeData([
          `test,container_name=cool dopeness=12 ${now - 1000}000000`,
          `test,container_name=beans dopeness=18 ${now - 1200}000000`,
          `test,container_name=cool dopeness=14 ${now - 1400}000000`,
          `test,container_name=beans dopeness=10 ${now - 1600}000000`,
        ])
        cy.createCSVVariable(orgID, 'static', ['beans', 'defbuck'])
        cy.createQueryVariable(
          orgID,
          'dependent',
          `from(bucket: v.static)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "test")
  |> keep(columns: ["container_name"])
  |> rename(columns: {"container_name": "_value"})
  |> last()
  |> group()`
        )

        cy.fixture('routes').then(({orgs}) => {
          cy.visit(`${orgs}/${orgID}/dashboards/${dashboard.id}`)
        })
      })
    })

    cy.getByTestID('add-cell--button').click()
    cy.getByTestID('switch-to-script-editor').should('be.visible')
    cy.getByTestID('switch-to-script-editor').click()
    cy.getByTestID('toolbar-tab').click()

    cy
      .getByTestID('flux-editor')
      .should('be.visible')
      .click()
      .focused().type(`from(bucket: v.static)
|> range(start: v.timeRangeStart, stop: v.timeRangeStop)
|> filter(fn: (r) => r["_measurement"] == "test")
|> filter(fn: (r) => r["_field"] == "dopeness")
|> filter(fn: (r) => r["container_name"] == v.dependent)`)
    cy.getByTestID('save-cell--button').click()

    // the default bucket selection should have no results
    cy.getByTestID('variable-dropdown')
      .eq(0)
      .should('contain', 'beans')

    // and cause the rest to exist in loading states
    cy.getByTestID('variable-dropdown')
      .eq(1)
      .should('contain', 'Loading')

    cy.getByTestID('cell--view-empty')

    // But selecting a nonempty bucket should load some data
    cy.getByTestID('variable-dropdown--button')
      .eq(0)
      .click()
    cy.get(`#defbuck`).click()

    // default select the first result
    cy.getByTestID('variable-dropdown')
      .eq(1)
      .should('contain', 'beans')

    // and also load the second result
    cy.getByTestID('variable-dropdown--button')
      .eq(1)
      .click()
    cy.get(`#cool`).click()
  })

  it('can create a view through the API', () => {
    cy.get('@org').then(({id: orgID}: Organization) => {
      cy.createDashWithViewAndVar(orgID).then(() => {
        cy.fixture('routes').then(({orgs}) => {
          cy.visit(`${orgs}/${orgID}/dashboards`)
          cy.getByTestID('dashboard-card--name').click()
          cy.get('.cell--view').should('have.length', 1)
        })
      })
    })
  })

  it("Should return empty table parameters when query hasn't been submitted", () => {
    cy.get('@org').then(({id: orgID}: Organization) => {
      cy.createDashboard(orgID).then(({body}) => {
        cy.fixture('routes').then(({orgs}) => {
          cy.visit(`${orgs}/${orgID}/dashboards/${body.id}`)
        })
      })
    })

    cy.getByTestID('add-cell--button')
      .click()
      .then(() => {
        cy.get('.view-options').should('not.exist')
        cy.getByTestID('cog-cell--button')
          .should('have.length', 1)
          .click()
        // should toggle the view options
        cy.get('.view-options').should('exist')
        cy.getByTestID('dropdown--button')
          .contains('Graph')
          .click()
          .then(() => {
            cy.getByTestID('view-type--table')
              .contains('Table')
              .should('have.length', 1)
              .click()

            cy.getByTestID('empty-state--text')
              .contains('This query returned no columns')
              .should('exist')
          })
      })
  })
})
